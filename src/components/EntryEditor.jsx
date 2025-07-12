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
  // Taastan lokaalse state'i
  const [entry, updateEntry] = useState({ text: "", ...props.entry });

  // Leia muudatused (Changes)
  let changes = [];
  let currentEntry = entry;
  const isAddEntry = entry && !Number.isNaN(Number(entry.ago));

  if (props.allEntries && entry && !isAddEntry) {
    let base = entry;
    while (base.amends) {
      const prev = props.allEntries.find(e => e.datetime === base.amends);
      if (!prev) break;
      base = prev;
    }
    let chain = [base];
    let next = props.allEntries.find(e => e.amends === base.datetime);
    while (next) {
      chain.push(next);
      next = props.allEntries.find(e => e.amends === next.datetime);
    }
    changes = [...chain].reverse();
    if (changes.length > 1) {
      currentEntry = changes[changes.length - 1];
    }
  }

  // Kaitse: uuenda state'i ainult kui currentEntry muutub ja erineb entry'st
  useEffect(() => {
    if (currentEntry && JSON.stringify(currentEntry) !== JSON.stringify(entry)) {
      updateEntry({ ...currentEntry });
    }
    // eslint-disable-next-line
  }, [JSON.stringify(currentEntry)]);

  if (!entry) {
    return <div>Loading...</div>;
  }

  const fixTypes = [
    'GPS',
    'GNSS',
    'Visual',
    'Radar',
    'Celestial',
    'DR',
  ];

  // Default: should observations be open?
  const [open, setOpen] = React.useState(currentEntry.observations || !Number.isNaN(Number(currentEntry.ago)) ? 'observations' : '');
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
      ...currentEntry,
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
    // updateEntry(updated); // This line is removed as per the edit hint
  }
  function deleteEntry() {
    props.delete(currentEntry);
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
  if (props.allEntries && currentEntry && Number.isNaN(Number(currentEntry.ago))) {
    // Kui on Add entry (uuel kirjel on ago olemas ja number), ära kuva
  } else if (props.allEntries && currentEntry) {
    previousEntries = props.allEntries
      .filter(e => e.datetime !== currentEntry.datetime)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);
  }

  // Leia, kas see kirje on kõige uuem (st ükski teine kirje ei viita sellele amends-väljaga)
  let isLatest = true;
  if (props.allEntries && currentEntry) {
    isLatest = !props.allEntries.some(e => e.amends === currentEntry.datetime);
  }

  return (
    <Modal isOpen={true} toggle={props.cancel}>
      <ModalHeader toggle={props.cancel}>
        { Number.isNaN(Number(currentEntry.ago))
          && `Log entry ${currentEntry.date.toLocaleString('en-GB', {
            timeZone: props.displayTimeZone,
          })} by ${currentEntry.author || 'auto'}`}
        { !Number.isNaN(Number(currentEntry.ago))
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
              value={currentEntry.text}
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
          { !Number.isNaN(Number(currentEntry.ago))
            && <FormGroup>
            <Label for="ago">
              This happened
            </Label>
            <Input
              id="ago"
              name="ago"
              type="select"
              value={currentEntry.text}
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
              value={currentEntry.category}
              onChange={handleChange}
              disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'category' !== 'category')}
            >
              {props.categories.map((category) => (
              <option key={category} value={category}>{category}</option>
              ))}
            </Input>
          </FormGroup>
          { currentEntry.category === 'radio'
            && <FormGroup>
                <Label for="vhf">
                  VHF channel
                </Label>
                <Input
                  id="vhf"
                  name="vhf"
                  placeholder="16"
                  value={currentEntry.vhf}
                  onChange={handleChange}
                  disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'vhf' !== 'vhf')}
                />
              </FormGroup>
          }
          { currentEntry.category === 'navigation'
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
                      value={currentEntry.observations ? currentEntry.observations.seaState : -1}
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
                        value={currentEntry.observations ? currentEntry.observations.cloudCoverage : -1}
                        onChange={handleChange}
                        disabled={!(isLatest && changes[changes.length-1]?.datetime === currentEntry.datetime) || (isAutomaticEntry(currentEntry) && 'cloudCoverage' !== 'cloudCoverage')}
                      />
                      <InputGroupText>
                        {currentEntry.observations
                          && currentEntry.observations.cloudCoverage > -1 ? `${currentEntry.observations.cloudCoverage}/8` : 'n/a'}
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
                      value={currentEntry.observations ? currentEntry.observations.visibility : -1}
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
                      value={currentEntry.position ? currentEntry.position.latitude : ''}
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
                      value={currentEntry.position ? currentEntry.position.longitude : ''}
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
                      value={currentEntry.position ? currentEntry.position.source : ''}
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
        <Button color="primary" onClick={() => {
          if (!entry.text || entry.text.trim() === "") {
            alert("Logikirje tekst ('Remarks') on kohustuslik!");
            return;
          }
          props.save(entry);
        }}>
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
