import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  List,
  ListInlineItem,
  Button,
} from 'reactstrap';
import ordinal from 'ordinal';
import CrewEditor from './CrewEditor.jsx';
import FilterEditor from './FilterEditor.jsx';

function Metadata(props) {
  const [editCrew, setEditCrew] = useState(false);
  const [editFilter, setEditFilter] = useState(false);
  const [crewNames, setCrew] = useState([]);
  const paths = [
    'communication.crewNames',
  ];
  const activeSails = []; // No longer fetching sails, so activeSails is empty

  function onMessage(m) {
    const delta = JSON.parse(m.data);
    if (!delta.updates) {
      return;
    }
    delta.updates.forEach((u) => {
      if (!u.values) {
        return;
      }
      u.values.forEach((v) => {
        if (v.path === 'communication.crewNames') {
          if (JSON.stringify(crewNames) !== JSON.stringify(v.value)) {
            setCrew(v.value);
          }
          return;
        }
      });
    });
  }

  useEffect(() => {
    let ws;
    fetch('/signalk/v1/api/vessels/self/communication/crewNames')
      .then((r) => r.json(), () => [])
      .then((crew) => {
        if (JSON.stringify(crewNames) !== JSON.stringify(crew.value)) {
          setCrew(crew.value);
          return Promise.reject(new Error('Skip'));
        }
        return Promise.resolve();
      })
      .then(() => {
        ws = props.adminUI.openWebsocket({ subscribe: 'none' });
        ws.onopen = () => {
          ws.send(JSON.stringify({
            context: 'vessels.self',
            subscribe: paths.map((path) => ({
              path,
              period: 10000,
            })),
          }));
        };
        ws.onmessage = onMessage;
      })
      .catch(() => {});
    return () => {
      if (!ws) {
        return;
      }
      ws.close();
    };
  }, [crewNames]);

  function saveCrew(updatedCrew) {
    fetch('/signalk/v1/api/vessels/self/communication/crewNames', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: updatedCrew,
      }),
    })
      .then(() => {
        setEditCrew(false);
        setCrew(updatedCrew);
        setTimeout(() => {
          // We want to reload with a slight delay
          props.setNeedsUpdate(true);
        }, 1000);
      });
  }
  function saveFilter(filter) {
    fetch('/signalk/v1/applicationData/user/signalk-logbook/1.0', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter,
      }),
    })
      .then(() => {
        setEditFilter(false);
        props.setDaysToShow(filter.daysToShow);
        // And then reload logs
        props.setNeedsUpdate(true);
      });
  }

  return (
    <Row xs>
    { editCrew ? <CrewEditor
      crewNames={crewNames}
      cancel={() => setEditCrew(false)}
      save={saveCrew}
      username={props.loginStatus.username}
      /> : null }
    { editFilter ? <FilterEditor
      cancel={() => setEditFilter(false)}
      daysToShow={props.daysToShow}
      save={saveFilter}
        /> : null }
    <Col>
    <List type="unstyled">
    <ListInlineItem><b>Crew</b></ListInlineItem>
    {crewNames.map((crewName) => (
      <ListInlineItem
      key={crewName}
      onClick={() => setEditCrew(true)}
      >{crewName}</ListInlineItem>
    ))}
    {!crewNames.length
        && <Button onClick={() => setEditCrew(true)} size="sm">Edit</Button>
    }
    </List>
    </Col>
    <Col>
      <List type="unstyled">
        <ListInlineItem><b>Show</b></ListInlineItem>
        <ListInlineItem
          onClick={() => setEditFilter(true)}
        >
          Last {props.daysToShow} days
        </ListInlineItem>
      </List>
    </Col>
    <Col className="text-end text-right">
    <List type="unstyled">
    <ListInlineItem><b>Sails</b></ListInlineItem>
    {activeSails.map((sail) => {
      let reduced = '';
      if (sail.reducedState && sail.reducedState.reefs) {
        reduced = ` (${ordinal(sail.reducedState.reefs)} reef)`;
      }
      if (sail.reducedState && sail.reducedState.furledRatio) {
        reduced = ` (${sail.reducedState.furledRatio * 100}% furled)`;
      }
      return (
        <ListInlineItem
        key={sail.id}
        onClick={() => {}} // No longer editable
        >
        {sail.name}{reduced}
        </ListInlineItem>
      );
    })}
    {!activeSails.length
        && <Button
      onClick={() => {}} // No longer editable
        >
        Edit
        </Button>
    }
    </List>
    </Col>
    </Row>
  );
}

export default Metadata;
