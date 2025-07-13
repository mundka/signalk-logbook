import React, { useState } from 'react';
import {
  Table,
  Button,
} from 'reactstrap';
import { Point } from 'where';
import { FaExclamationTriangle, FaChevronDown, FaChevronRight } from 'react-icons/fa';

function getWeather(entry) {
  const weather = [];
  if (entry.wind) {
    const wind = [];
    if (!Number.isNaN(Number(entry.wind.speed))) {
      wind.push(`${entry.wind.speed}kt`);
    }
    if (!Number.isNaN(Number(entry.wind.direction))) {
      wind.push(`${entry.wind.direction}°`);
    }
    if (wind.length) {
      weather.push(`Wind ${wind.join(' ')}`);
    }
  }
  if (entry.observations) {
    if (!Number.isNaN(Number(entry.observations.seaState))) {
      weather.push(`Sea state ${entry.observations.seaState}`);
    }
    if (!Number.isNaN(Number(entry.observations.cloudCoverage))) {
      weather.push(`Clouds ${entry.observations.cloudCoverage}/8`);
    }
    if (!Number.isNaN(Number(entry.observations.visibility))) {
      weather.push(`Visibility ${entry.observations.visibility + 1}`);
    }
  }
  return weather.join(', ');
}

function getCourse(entry) {
  if (!Number.isNaN(Number(entry.course))) {
    return `${entry.course}°`;
  }
  if (!Number.isNaN(Number(entry.heading))) {
    return `HDT ${entry.heading}°`;
  }
  return '';
}

function buildAmendChains(entries) {
  // Map datetime -> entry
  const byId = {};
  entries.forEach(e => { byId[e.datetime] = e; });
  // Map amends -> [chain]
  const chains = [];
  const used = new Set();
  entries.forEach(entry => {
    if (used.has(entry.datetime)) return;
    // Leia chain (amend ahel)
    let chain = [entry];
    let cur = entry;
    while (cur.amends) {
      const prev = byId[cur.amends];
      if (!prev) break;
      chain.unshift(prev);
      used.add(prev.datetime);
      cur = prev;
    }
    // Leia, kas keegi viitab sellele (on chaini osa)
    let isAmended = entries.some(e => e.amends === entry.datetime);
    if (!isAmended) {
      chains.push(chain);
      chain.forEach(e => used.add(e.datetime));
    }
  });
  return chains;
}

function Logbook(props) {
  const [openChains, setOpenChains] = useState({});
  const entries = props.entries.map((entry) => ({
    ...entry,
    point: entry.position ? new Point(entry.position.latitude, entry.position.longitude) : null,
    date: new Date(entry.datetime),
  }));
  // Ehita amend chainid
  const chains = buildAmendChains(entries);

  function toggleChain(idx) {
    setOpenChains(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div>
      <Table striped hover responsive>
        <thead>
          <tr>
            <th></th>
            <th>Time</th>
            <th>Course</th>
            <th>Speed</th>
            <th>Weather</th>
            <th>Baro</th>
            <th>Coordinates</th>
            <th>Fix</th>
            <th>Log</th>
            <th>Engine</th>
            <th>By</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
        {chains.map((chain, idx) => {
          const last = chain[chain.length - 1];
          return <React.Fragment key={last.datetime}>
            <tr onClick={() => props.editEntry(last)}>
              <td style={{ cursor: chain.length > 1 ? 'pointer' : 'default' }} onClick={e => { e.stopPropagation(); if (chain.length > 1) toggleChain(idx); }}>
                {chain.length > 1 ? (openChains[idx] ? <FaChevronDown /> : <FaChevronRight />) : null}
              </td>
              <td>{last.date.toLocaleString('en-GB', { timeZone: props.displayTimeZone })}</td>
              <td>{getCourse(last)}</td>
              <td>{last.speed && !Number.isNaN(Number(last.speed.sog)) ? `${last.speed.sog}kt` : ''}</td>
              <td>{getWeather(last)}</td>
              <td>{last.barometer}</td>
              <td>{last.point ? last.point.toString() : 'n/a'}</td>
              <td>{last.position ? last.position.source || 'GPS' : ''}</td>
              <td>{!Number.isNaN(Number(last.log)) ? `${last.log}NM` : ''}</td>
              <td>{last.engine && !Number.isNaN(Number(last.engine.hours)) ? `${last.engine.hours}h` : ''}</td>
              <td>
                {last.author || 'auto'}
                {last.signatureValid === false && (
                  <span title="Logikirje on muudetud või rikutud" style={{ color: 'red', marginLeft: 4 }}>
                    <FaExclamationTriangle />
                  </span>
                )}
              </td>
              <td>{last.text}</td>
            </tr>
            {chain.length > 1 && openChains[idx] && chain.slice(0, -1).map((e, i) => (
              <tr key={e.datetime} style={{ background: '#f6f6f6', fontSize: '0.95em' }}>
                <td></td>
                <td colSpan={11} style={{ paddingLeft: 32 }}>
                  <b>{e.date.toLocaleString('en-GB', { timeZone: props.displayTimeZone })}</b> — {e.text}
                </td>
              </tr>
            ))}
          </React.Fragment>;
        })}
        </tbody>
      </Table>
      <Button color="primary" onClick={props.addEntry}>Add entry</Button>
    </div>
  );
}

export default Logbook;
