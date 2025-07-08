import React, { useState } from 'react';
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
  function saveEntry(entry) {
    // Kui tegemist on muudatusega (on olemas entry.datetime), salvesta POST-iga ja lisa amends
    if (entry && entry.datetime) {
      const newEntry = {
        ...entry,
        amends: entry.datetime,
        datetime: new Date().toISOString(), // Uus unikaalne aeg
      };
      delete newEntry.signatureValid;
      delete newEntry.signature;
      delete newEntry.originalSignature;
      fetch('/plugins/signalk-logbook/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEntry),
      })
        .then(() => {
          props.cancel();
          if (props.setNeedsUpdate) props.setNeedsUpdate(true);
        });
      return;
    }
    // ... olemasolev saveEntry loogika ...
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

  // Leia muudatused (Changes)
  let changes = [];
  if (props.allEntries && entry) {
    // Leia kõik muudatused, mis viitavad sellele kirjele või millele see kirje viitab
    const baseDatetime = entry.amends || entry.datetime;
    changes = props.allEntries.filter(e => e.amends === baseDatetime || (entry.amends && e.datetime === entry.amends));
    // Sorteeri ajaliselt
    changes.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
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
        { Number.isNaN(Number(entry.ago))
          && <Row>
          <Col className="text-end text-right">
            <Button color="danger" onClick={deleteEntry}>
              Delete
            </Button>
          </Col>
        </Row>
        }
        <Form>
          <FormGroup>
            <Label for="text">
              Remarks
            </Label>
            <Input
              id="text"
              name="text"
              type="textarea"
              placeholder="Tell what happened"
              value={entry.text}
              onChange={handleChange}
              disabled={isAutomaticEntry(entry) && 'text' !== 'text'}
            />
          </FormGroup>
          {changes.length > 0 && (
            <FormGroup>
              <Label>Changes</Label>
              <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, background: '#fafbfc' }}>
                {changes.map((c, idx) => (
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
              disabled={isAutomaticEntry(entry) && 'text' !== 'text'}
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
              disabled={isAutomaticEntry(entry) && 'category' !== 'category'}
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
                  disabled={isAutomaticEntry(entry) && 'vhf' !== 'vhf'}
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
                      disabled={isAutomaticEntry(entry) && 'seaState' !== 'seaState'}
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
                        disabled={isAutomaticEntry(entry) && 'cloudCoverage' !== 'cloudCoverage'}
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
                      disabled={isAutomaticEntry(entry) && 'visibility' !== 'visibility'}
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
                      disabled={isAutomaticEntry(entry) && 'latitude' !== 'latitude'}
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
                      disabled={isAutomaticEntry(entry) && 'longitude' !== 'longitude'}
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
                      disabled={isAutomaticEntry(entry) && 'source' !== 'source'}
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
        <Button color="primary" onClick={() => saveEntry(entry)}>
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
