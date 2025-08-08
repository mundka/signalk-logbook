import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
} from 'reactstrap';
import Metadata from './Metadata.jsx';
import Timeline from './Timeline.jsx';
import Logbook from './Logbook.jsx';
import Map from './Map.jsx';
import Service from './Service.jsx';
import EntryEditor from './EntryEditor.jsx';
import EntryViewer from './EntryViewer.jsx';

const categories = [
  'navigation',
  'engine',
  'radio',
  'maintenance',
];

function AppPanel(props) {
  const [data, setData] = useState({
    entries: [],
  });
  const [activeTab, setActiveTab] = useState('timeline'); // Maybe timeline on mobile, book on desktop?
  const [daysToShow, setDaysToShow] = useState(7);
  const [editEntry, setEditEntry] = useState(null);
  const [viewEntry, setViewEntry] = useState(null);
  const [addEntry, setAddEntry] = useState(null);
  const [needsUpdate, setNeedsUpdate] = useState(true);
  const [timezone, setTimezone] = useState('UTC');
  const [pluginVersion, setPluginVersion] = useState('');
  const [latestPosition, setLatestPosition] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);

  const loginStatus = props.loginStatus.status;

  // Signal K navigation.position päring
  useEffect(() => {
    function fetchPosition() {
      fetch('/signalk/v1/api/vessels/self/')
        .then(res => res.json())
        .then(data => {
          // navigation.position võib olla otse või nested
          let pos = null;
          if (data && data.navigation && data.navigation.position && data.navigation.position.value) {
            pos = data.navigation.position.value;
          }
          if (pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
            setCurrentPosition({
              latitude: pos.latitude,
              longitude: pos.longitude,
              source: 'GPS'
            });
          }
        });
    }
    fetchPosition();
    const interval = setInterval(fetchPosition, 5000); // uuenda iga 5 sek järel
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!needsUpdate) {
      return undefined;
    }
    if (loginStatus === 'notLoggedIn') {
      // The API only works for authenticated users
      return undefined;
    }

    // We'll want to re-fetch logs periodically
    const interval = setInterval(() => {
      setNeedsUpdate(true);
    }, 5 * 60000);

    fetch('/plugins/signalk-logbook/logs')
      .then((res) => res.json())
      .then((days) => {
        const showFrom = new Date();
        showFrom.setDate(showFrom.getDate() - daysToShow);
        const toShow = days.filter((d) => d >= showFrom.toISOString().substr(0, 10));
        Promise.all(toShow.map((day) => fetch(`/plugins/signalk-logbook/logs/${day}`)
          .then((r) => r.json())))
          .then((dayEntries) => {
            const entries = [].concat.apply([], dayEntries); // eslint-disable-line prefer-spread
            setData({
              entries,
            });
            setNeedsUpdate(false);
            // Leia viimane navigation kirje, millel on position
            const navEntry = entries
              .filter(e => e.category === 'navigation' && e.position && typeof e.position.latitude !== 'undefined' && typeof e.position.longitude !== 'undefined')
              .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];
            if (navEntry) {
              setLatestPosition({ ...navEntry.position });
            }
          });
      });
    return () => {
      clearInterval(interval);
    };
  }, [daysToShow, needsUpdate, loginStatus]);
  // TODO: Depend on chosen time window to reload as needed

  useEffect(() => {
    fetch('/signalk/v1/applicationData/user/signalk-logbook/1.0')
      .then((r) => r.json())
      .then((v) => {
        if (v && v.filter && v.filter.daysToShow) {
          setDaysToShow(v.filter.daysToShow);
        }
      });
  }, [loginStatus]);

  useEffect(() => {
    fetch('/plugins/signalk-logbook/config')
      .then((r) => r.json())
      .then((v) => {
        if (!v.configuration) {
          return;
        }
        if (v.configuration.displayTimeZone) {
          setTimezone(v.configuration.displayTimeZone);
        }
      });
  }, [timezone]);

  useEffect(() => {
    fetch('/plugins/signalk-logbook/version')
      .then((r) => r.json())
      .then((v) => {
        if (v && v.version) setPluginVersion(v.version);
      });
  }, []);

  function saveEntry(entry) {
    // Kui tegemist on muudatusega (edit), loo amendment POST päringuga
    const isEdit = !!entry.datetime && !Number.isNaN(Date.parse(entry.datetime));
    if (isEdit) {
      const savingEntry = {
        ...entry,
        amends: entry.datetime,
        datetime: new Date().toISOString(),
      };
      delete savingEntry.point;
      delete savingEntry.date;
      delete savingEntry.signatureValid;
      fetch(`/plugins/signalk-logbook/logs/${entry.datetime.substr(0, 10)}/${entry.datetime}`, {
        method: "PUT",
        headers: {
        },
        body: JSON.stringify(savingEntry),
      })
        .then(() => {
          setEditEntry(null);
          setNeedsUpdate(true);
        });
      return;
    }
    // Kui on täiesti uus kirje (nt Add entry), kasuta olemasolevat loogikat
    saveAddEntry(entry);
  }

  function saveAddEntry(entry) {
    // Sanitize
    const savingEntry = {
      ...entry,
    };
    delete savingEntry.signatureValid;
    delete savingEntry.audit;
    fetch('/plugins/signalk-logbook/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(savingEntry),
    })
      .then(() => {
        setAddEntry(null);
        setNeedsUpdate(true);
      });
  }

  function deleteEntry(entry) {
    const dateString = new Date(entry.datetime).toISOString().substr(0, 10);
    fetch(`/plugins/signalk-logbook/logs/${dateString}/${entry.datetime}`, {
      method: 'DELETE',
    })
      .then(() => {
        setEditEntry(null);
        setNeedsUpdate(true);
      });
  }

  if (props.loginStatus.status === 'notLoggedIn' && props.loginStatus.authenticationRequired) {
    return <props.adminUI.Login />;
  }

  return (
    <div>
      <Metadata
        adminUI={props.adminUI}
        loginStatus={props.loginStatus}
        daysToShow={daysToShow}
        setDaysToShow={setDaysToShow}
        setNeedsUpdate={setNeedsUpdate}
      />
      <Row>
        { editEntry ? <EntryEditor
          entry={editEntry}
          cancel={() => setEditEntry(null)}
          save={saveEntry}
          delete={deleteEntry}
          categories={categories}
          displayTimeZone={timezone}
          allEntries={data.entries}
          /> : null }
        { viewEntry ? <EntryViewer
          entry={viewEntry}
          editEntry={setEditEntry}
          cancel={() => setViewEntry(null)}
          categories={categories}
          displayTimeZone={timezone}
          /> : null }
        { addEntry ? <EntryEditor
          entry={addEntry}
          cancel={() => setAddEntry(null)}
          save={saveAddEntry}
          categories={categories}
          /> : null }
        <Col className="bg-light border">
          <Nav tabs>
            <NavItem>
              <NavLink className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}>
                Timeline
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink className={activeTab === 'book' ? 'active' : ''} onClick={() => {
                setActiveTab('book');
                props.adminUI.hideSideBar();
              }}>
                Logbook
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink className={activeTab === 'map' ? 'active' : ''} onClick={() => setActiveTab('map')}>
                Map
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink className={activeTab === 'service' ? 'active' : ''} onClick={() => setActiveTab('service')}>
                Service
              </NavLink>
            </NavItem>
          </Nav>
          <TabContent activeTab={activeTab}>
            <TabPane tabId="timeline">
              { activeTab === 'timeline' ? <Timeline entries={data.entries} displayTimeZone={timezone} editEntry={setEditEntry} addEntry={() => setAddEntry({ ago: 0, category: 'navigation', position: currentPosition })} /> : null }
            </TabPane>
            <TabPane tabId="book">
              { activeTab === 'book' ? <Logbook entries={data.entries} displayTimeZone={timezone} editEntry={setEditEntry} addEntry={() => setAddEntry({ ago: 0, category: 'navigation', position: currentPosition })} /> : null }
            </TabPane>
            <TabPane tabId="map">
              { activeTab === 'map' ? <Map entries={data.entries} editEntry={setEditEntry} viewEntry={setViewEntry} /> : null }
            </TabPane>
            <TabPane tabId="service">
              { activeTab === 'service' ? <Service displayTimeZone={timezone} onDataChange={() => setNeedsUpdate(true)} /> : null }
            </TabPane>
          </TabContent>
        </Col>
      </Row>
      <div style={{ fontFamily: 'monospace', fontSize: '1.2em', color: '#007bff' }}>
        Plugin version {pluginVersion || '...'} (live test)
      </div>
    </div>
  );
}

export default AppPanel;
