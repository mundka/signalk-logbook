import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  InputGroup,
  InputGroupText,
  Row,
  Col,
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
} from 'reactstrap';
import { getSeaStates, getVisibility } from '../helpers/observations';

function EntryEditor(props) {
  const [entry, updateEntry] = useState({
    ...props.entry,
  });

  // Leia muudatused (Changes)
  let changes = [];
  let currentEntry = entry;
  if (props.allEntries && entry) {
    // Leia ahela algus (originaalkirje)
    let base = entry;
    while (base.amends) {
      const prev = props.allEntries.find(e => e.datetime === base.amends);
      if (!prev) break;
      base = prev;
    }
    // Kogu ahel: originaalist kuni kõige uuemani
    let chain = [base];
    let next = props.allEntries.find(e => e.amends === base.datetime);
    while (next) {
      chain.push(next);
      next = props.allEntries.find(e => e.amends === next.datetime);
    }
    // Kuvame ahela tagurpidi (uusim -> vanim)
    changes = [...chain].reverse();
    // Kui on olemas muudatusi, kasuta kõige uuemat versiooni
    if (changes.length > 1) {
      currentEntry = changes[changes.length - 1];
    }
  }

  // Update entry state when currentEntry changes
  useEffect(() => {
    if (currentEntry && currentEntry !== props.entry) {
      updateEntry({
        ...currentEntry,
      });
    }
  }, [currentEntry]);

  const fixTypes = [
    'GPS',
    'GNSS',
    'Visual',
    'Radar',
    'Celestial',
    'DR',
  ];

  // Default: should observations be open?
  const [open, setOpen] = useState(entry.observations || !Number.isNaN(Number(entry.ago)) ? 'observations' : '');
  function toggle(id) {
    if (open === id) {
      setOpen();
    } else {
      setOpen(id);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    const updated = {
      ...entry,
    };
    switch (name) {
      case 'seaState':
      case 'cloudCoverage':
      case 'visibility': {
        if (!updated.observations) {
          updated.observations = {};
        } else {
          updated.observations = {
            ...updated.observations,
          };
        }
        const val = parseInt(value, 10);
        if (val === -1) {
          // No observation
          delete updated.observations[name];
        } else {
          updated.observations[name] = val;
        }
        break;
      }
      case 'latitude':
      case 'longitude':
      case 'source': {
        if (!updated.position) {
          updated.position = {};
        } else {
          updated.position = {
            ...updated.position,
          };
        }
        const val = name === 'source' ? value : Number(value);
        updated.position[name] = val;
        break;
      }
      case 'ago': {
        updated[name] = parseInt(value, 10);
        break;
      }
      default: {
        updated[name] = value;
      }
    }
    updateEntry(updated);
  }
  function deleteEntry() {
    props.delete(entry);
  }
  const seaStates = getSeaStates();
  const visibility = getVisibility();
  const agoOptions = [
    0,
    5,
    10,
    15,
  ];

  // Lisa utiliit, mis tuvastab automaatse logikirje
  function isAutomaticEntry(entry) {
    return entry && (entry.author === 'Automatic' || entry.text === 'Automatic log entry');
  }

  // Leia eelnevad logikirjed (Add entry puhul)
  let previousEntries = [];
  if (props.allEntries && entry && Number.isNaN(Number(entry.ago))) {
    // Kui on Add entry (uuel kirjel on ago olemas ja number), ära kuva
  } else if (props.allEntries && entry) {
    previousEntries = props.allEntries
      .filter(e => e.datetime !== entry.datetime)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);
  }

  // Leia, kas see kirje on kõige uuem (st ükski teine kirje ei viita sellele amends-väljaga)
  let isLatest = true;
  if (props.allEntries && entry) {
    isLatest = !props.allEntries.some(e => e.amends === entry.datetime);
  }

  return (
    <Modal isOpen={true} toggle={props.cancel}>
      <ModalHeader toggle={props.cancel}>
        { Number.isNaN(Number(entry.ago))
          && `Log entry ${entry.date.toLocaleString('en-GB', {
            timeZone: props.displayTimeZone,
          })} by ${entry.author || 'auto'}`}
        { !Number.isNaN(Number(entry.ago))
          && 'New entry'}
      </ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup>
            <Label for="text">
              Remarks
            </Label>
            {previousEntries.length > 0 && (
              <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, background: '#fafbfc', marginBottom: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Previous entries</div>
                {previousEntries.map((c) => (
                  <div key={c.datetime} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>{new Date(c.datetime).toLocaleString('en-GB', { timeZone: props.displayTimeZone })}</div>
                    <div style={{ fontWeight: 'bold' }}>{c.text}</div>
                  </div>
                ))}
              </div>
            )}
            <Input
              id="text"
              name="text"
              type="textarea"
              placeholder="Tell what happened"
              value={entry.text}
              onChange={handleChange}
              disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'text' !== 'text')}
            />
          </FormGroup>
          {changes.length > 1 && (
            <FormGroup>
              <Label>Previous versions</Label>
              <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, background: '#fafbfc' }}>
                {changes.slice(0, -1).map((c, idx) => (
                  <div key={c.datetime} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>{new Date(c.datetime).toLocaleString('en-GB', { timeZone: props.displayTimeZone })}</div>
                    <div style={{ fontWeight: 'bold' }}>{c.text}</div>
                  </div>
                ))}
              </div>
            </FormGroup>
          )}
          { !Number.isNaN(Number(entry.ago))
            && <FormGroup>
            <Label for="ago">
              This happened
            </Label>
            <Input
              id="ago"
              name="ago"
              type="select"
              value={entry.text}
              onChange={handleChange}
              disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'text' !== 'text')}
            >
              {agoOptions.map((ago) => (
              <option key={ago} value={ago}>{ago} minutes ago</option>
              ))}
            </Input>
          </FormGroup>
          }
          <FormGroup>
            <Label for="category">
              Category
            </Label>
            <Input
              id="category"
              name="category"
              type="select"
              value={entry.category}
              onChange={handleChange}
              disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'category' !== 'category')}
            >
              {props.categories.map((category) => (
              <option key={category} value={category}>{category}</option>
              ))}
            </Input>
          </FormGroup>
          { entry.category === 'radio'
            && <FormGroup>
                <Label for="vhf">
                  VHF channel
                </Label>
                <Input
                  id="vhf"
                  name="vhf"
                  placeholder="16"
                  value={entry.vhf}
                  onChange={handleChange}
                  disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'vhf' !== 'vhf')}
                />
              </FormGroup>
          }
          { entry.category === 'navigation'
            && <Accordion open={open} toggle={toggle}>
              <AccordionItem>
                <AccordionHeader targetId="observations">Observations</AccordionHeader>
                <AccordionBody accordionId="observations">
                  <FormGroup>
                    <Label for="seaState">
                      Sea state
                    </Label>
                    <Input
                      id="seaState"
                      name="seaState"
                      type="select"
                      value={entry.observations ? entry.observations.seaState : -1}
                      onChange={handleChange}
                      disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'seaState' !== 'seaState')}
                    >
                      {seaStates.map((description, idx) => (
                      <option key={idx} value={idx - 1}>{description}</option>
                      ))}
                    </Input>
                  </FormGroup>
                  <FormGroup>
                    <Label for="cloudCoverage">
                      Cloud coverage
                    </Label>
                    <InputGroup>
                      <Input
                        id="cloudCoverage"
                        name="cloudCoverage"
                        type="range"
                        min="-1"
                        max="8"
                        step="1"
                        value={entry.observations ? entry.observations.cloudCoverage : -1}
                        onChange={handleChange}
                        disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'cloudCoverage' !== 'cloudCoverage')}
                      />
                      <InputGroupText>
                        {entry.observations
                          && entry.observations.cloudCoverage > -1 ? `${entry.observations.cloudCoverage}/8` : 'n/a'}
                      </InputGroupText>
                    </InputGroup>
                  </FormGroup>
                  <FormGroup>
                    <Label for="visibility">
                      Visibility
                    </Label>
                    <Input
                      id="visibility"
                      name="visibility"
                      type="select"
                      value={entry.observations ? entry.observations.visibility : -1}
                      onChange={handleChange}
                      disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'visibility' !== 'visibility')}
                    >
                      {visibility.map((description, idx) => (
                      <option key={idx} value={idx - 1}>{description}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </AccordionBody>
              </AccordionItem>
              <AccordionItem>
                <AccordionHeader targetId="position">Position</AccordionHeader>
                <AccordionBody accordionId="position">
                  <FormGroup>
                    <Label for="latitude">
                      Latitude
                    </Label>
                    <Input
                      id="latitude"
                      name="latitude"
                      type="number"
                      placeholder="52.51117"
                      max="90"
                      min="-90"
                      step="0.00001"
                      value={entry.position ? entry.position.latitude : ''}
                      onChange={handleChange}
                      disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'latitude' !== 'latitude')}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label for="longitude">
                      Longitude
                    </Label>
                    <Input
                      id="longitude"
                      name="longitude"
                      type="number"
                      placeholder="13.19329"
                      max="180"
                      min="-180"
                      step="0.00001"
                      value={entry.position ? entry.position.longitude : ''}
                      onChange={handleChange}
                      disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'longitude' !== 'longitude')}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label for="source">
                      Fix type
                    </Label>
                    <Input
                      id="source"
                      name="source"
                      type="select"
                      value={entry.position ? entry.position.source : ''}
                      onChange={handleChange}
                      disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'source' !== 'source')}
                    >
                      {fixTypes.map((fix) => (
                      <option key={fix} value={fix}>{fix}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </AccordionBody>
              </AccordionItem>
            </Accordion>
          }
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button color="primary" onClick={() => props.save(entry)}>
          Save
        </Button>{' '}
        <Button color="secondary" onClick={props.cancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default EntryEditor;
