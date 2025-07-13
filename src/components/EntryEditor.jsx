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
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
} from 'reactstrap';
import { getSeaStates, getVisibility } from '../helpers/observations';

function EntryEditor(props) {
  // Kas tegemist on uue kirjega?
  const isAddEntry = props.entry && props.entry.ago !== undefined;

  // Lokaalne state: alati props.entry põhjal, kuid Add entry puhul vaikimisi väärtused
  const [entry, setEntry] = useState(() => {
    if (isAddEntry) {
      return {
        text: '',
        category: props.categories[0] || '',
        ago: 0,
        observations: {},
        position: props.entry && props.entry.position ? { ...props.entry.position } : {},
        ...props.entry,
      };
    } else {
      return { ...props.entry };
    }
  });

  // Kui props.entry muutub (nt muud kirjet valitakse), uuenda state'i
  useEffect(() => {
    if (isAddEntry) {
      setEntry({
        text: '',
        category: props.categories[0] || '',
        ago: 0,
        observations: {},
        position: props.entry && props.entry.position ? { ...props.entry.position } : {},
        ...props.entry,
      });
    } else {
      setEntry({ ...props.entry });
    }
    // eslint-disable-next-line
  }, [props.entry]);

  // Lisa logi, et näha, mis väärtus on props.entry.position Add entry puhul
  useEffect(() => {
    if (isAddEntry) {
      console.log('Add entry: props.entry.position =', props.entry && props.entry.position);
    }
  }, [isAddEntry, props.entry]);

  // Muudatuste ahel (amend chain)
  let changes = [];
  let currentEntry = entry;
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

  // Previous entries: ainult selle logikirje muudatusahela varasemad versioonid
  let previousAmendEntries = [];
  if (changes.length > 1) {
    previousAmendEntries = changes.slice(0, -1);
  }

  // Kas see on viimane versioon?
  let isLatest = true;
  if (props.allEntries && currentEntry && !isAddEntry) {
    isLatest = !props.allEntries.some(e => e.amends === currentEntry.datetime);
  }

  // Väljade muutmine
  function handleChange(e) {
    const { name, value, type } = e.target;
    setEntry(prev => {
      let updated = { ...prev };
      switch (name) {
        case 'seaState':
        case 'cloudCoverage':
        case 'visibility': {
          updated.observations = { ...updated.observations };
          const val = parseInt(value, 10);
          if (val === -1) {
            delete updated.observations[name];
          } else {
            updated.observations[name] = val;
          }
          break;
        }
        case 'latitude':
        case 'longitude':
        case 'source': {
          updated.position = { ...updated.position };
          updated.position[name] = name === 'source' ? value : Number(value);
          break;
        }
        case 'ago': {
          updated.ago = parseInt(value, 10);
          break;
        }
        default: {
          updated[name] = type === 'number' ? Number(value) : value;
        }
      }
      return updated;
    });
  }

  // Utiliit automaatse logikirje tuvastamiseks
  function isAutomaticEntry(entry) {
    return entry && (entry.author === 'Automatic' || entry.text === 'Automatic log entry');
  }

  // Eelmised kirjed (Add entry puhul ei kuva)
  let previousEntries = [];
  if (props.allEntries && currentEntry && !isAddEntry) {
    previousEntries = props.allEntries
      .filter(e => e.datetime !== currentEntry.datetime)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);
  }

  // Accordion avatud sektsioon
  const [open, setOpen] = useState('');
  function toggle(id) {
    setOpen(open === id ? '' : id);
  }

  const seaStates = getSeaStates();
  const visibility = getVisibility();
  const fixTypes = [
    'GPS',
    'GNSS',
    'Visual',
    'Radar',
    'Celestial',
    'DR',
  ];
  const agoOptions = [0, 5, 10, 15];

  // Väljade lubatavus: Add entry puhul alati true, muidu ainult kui on viimane ja pole automaatne
  function isFieldEditable(field) {
    if (isAddEntry) return true;
    if (isAutomaticEntry(currentEntry)) return false;
    if (!isLatest) return false;
    return true;
  }

  // Utility: kas Add entry ja ago > 0?
  const isAddEntryAgoPast = isAddEntry && entry.ago && Number(entry.ago) > 0;
  const isAddEntryAgoNow = isAddEntry && (!entry.ago || Number(entry.ago) === 0);

  function validateAndSave() {
    if (!entry.text || entry.text.trim() === "") {
      alert("Logikirje tekst ('Remarks') on kohustuslik!");
      return;
    }
    let savingEntry = { ...entry };
    if (savingEntry.category !== 'navigation') {
      delete savingEntry.position;
    } else {
      // Kui position puudub või on tühi, proovi võtta input-väljade väärtused
      let lat = savingEntry.position?.latitude;
      let lon = savingEntry.position?.longitude;
      let source = savingEntry.position?.source;
      if ((lat === undefined || lat === '') && document.getElementById('latitude')) {
        lat = document.getElementById('latitude').value;
      }
      if ((lon === undefined || lon === '') && document.getElementById('longitude')) {
        lon = document.getElementById('longitude').value;
      }
      if ((source === undefined || source === '') && document.getElementById('source')) {
        source = document.getElementById('source').value;
      }
      if (!lat || !lon) {
        alert("Palun sisesta asukoht (latitude ja longitude)!");
        return;
      }
      savingEntry.position = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        source: source || 'GPS'
      };
      if (isNaN(savingEntry.position.latitude) || isNaN(savingEntry.position.longitude)) {
        alert("Latitude ja longitude peavad olema numbrid!");
        return;
      }
    }
    if (!savingEntry.datetime) {
      savingEntry.datetime = new Date().toISOString();
    }
    props.save(savingEntry);
  }

  return (
    <Modal isOpen={true} toggle={props.cancel}>
      <ModalHeader toggle={props.cancel}>
        {isAddEntry
          ? 'New entry'
          : `Log entry ${new Date(currentEntry.date || currentEntry.datetime).toLocaleString('en-GB', { timeZone: props.displayTimeZone })} by ${currentEntry.author || 'auto'}`}
      </ModalHeader>
      <ModalBody>
        <Form>
          <FormGroup>
            <Label for="text">Remarks</Label>
            {previousAmendEntries.length > 0 && (
              <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, background: '#fafbfc', marginBottom: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Previous entries</div>
                {previousAmendEntries.map((c) => (
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
              value={entry.text || ''}
              onChange={handleChange}
              disabled={!isFieldEditable('text')}
            />
          </FormGroup>
          {changes.length > 1 && (
            <FormGroup>
              <Label>Previous versions</Label>
              <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, background: '#fafbfc' }}>
                {changes.slice(0, -1).map((c) => (
                  <div key={c.datetime} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: '0.9em', color: '#888' }}>{new Date(c.datetime).toLocaleString('en-GB', { timeZone: props.displayTimeZone })}</div>
                    <div style={{ fontWeight: 'bold' }}>{c.text}</div>
                  </div>
                ))}
              </div>
            </FormGroup>
          )}
          {isAddEntry && (
            <FormGroup>
              <Label for="ago">This happened</Label>
              <Input
                id="ago"
                name="ago"
                type="select"
                value={entry.ago}
                onChange={handleChange}
                disabled={!isFieldEditable('ago')}
              >
                {agoOptions.map((ago) => (
                  <option key={ago} value={ago}>{ago} minutes ago</option>
                ))}
              </Input>
            </FormGroup>
          )}
          <FormGroup>
            <Label for="category">Category</Label>
            <Input
              id="category"
              name="category"
              type="select"
              value={entry.category || ''}
              onChange={handleChange}
              disabled={!isFieldEditable('category')}
            >
              {props.categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </Input>
          </FormGroup>
          {entry.category === 'radio' && (
            <FormGroup>
              <Label for="vhf">VHF channel</Label>
              <Input
                id="vhf"
                name="vhf"
                placeholder="16"
                value={entry.vhf || ''}
                onChange={handleChange}
                disabled={!isFieldEditable('vhf')}
              />
            </FormGroup>
          )}
          {entry.category === 'navigation' && (
            <Accordion open={open} toggle={toggle}>
              <AccordionItem>
                <AccordionHeader targetId="observations">Observations</AccordionHeader>
                <AccordionBody accordionId="observations">
                  <FormGroup>
                    <Label for="seaState">Sea state</Label>
                    <Input
                      id="seaState"
                      name="seaState"
                      type="select"
                      value={entry.observations?.seaState ?? -1}
                      onChange={handleChange}
                      disabled={!isFieldEditable('seaState')}
                    >
                      {seaStates.map((description, idx) => (
                        <option key={idx} value={idx - 1}>{description}</option>
                      ))}
                    </Input>
                  </FormGroup>
                  <FormGroup>
                    <Label for="cloudCoverage">Cloud coverage</Label>
                    <InputGroup>
                      <Input
                        id="cloudCoverage"
                        name="cloudCoverage"
                        type="range"
                        min="-1"
                        max="8"
                        step="1"
                        value={entry.observations?.cloudCoverage ?? -1}
                        onChange={handleChange}
                        disabled={!isFieldEditable('cloudCoverage')}
                      />
                      <InputGroupText>
                        {entry.observations && entry.observations.cloudCoverage > -1 ? `${entry.observations.cloudCoverage}/8` : 'n/a'}
                      </InputGroupText>
                    </InputGroup>
                  </FormGroup>
                  <FormGroup>
                    <Label for="visibility">Visibility</Label>
                    <Input
                      id="visibility"
                      name="visibility"
                      type="select"
                      value={entry.observations?.visibility ?? -1}
                      onChange={handleChange}
                      disabled={!isFieldEditable('visibility')}
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
                    <Label for="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      name="latitude"
                      type="number"
                      placeholder="52.51117"
                      max="90"
                      min="-90"
                      step="0.00001"
                      value={entry.position?.latitude ?? ''}
                      onChange={handleChange}
                      disabled={false}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label for="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      name="longitude"
                      type="number"
                      placeholder="13.19329"
                      max="180"
                      min="-180"
                      step="0.00001"
                      value={entry.position?.longitude ?? ''}
                      onChange={handleChange}
                      disabled={false}
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label for="source">Fix type</Label>
                    <Input
                      id="source"
                      name="source"
                      type="select"
                      value={entry.position?.source ?? ''}
                      onChange={handleChange}
                      disabled={false}
                    >
                      {fixTypes.map((fix) => (
                        <option key={fix} value={fix}>{fix}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </AccordionBody>
              </AccordionItem>
            </Accordion>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button color="primary" onClick={validateAndSave}>
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
