import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, Row, Col, Button, Table } from "reactstrap";

// Helper functions for report calculations
function formatPosition(position) {
  if (!position || !position.latitude || !position.longitude) return "N/A";
  
  const lat = Math.abs(position.latitude);
  const latDeg = Math.floor(lat);
  const latMin = ((lat - latDeg) * 60).toFixed(3);
  const latDir = position.latitude >= 0 ? 'N' : 'S';
  
  const lon = Math.abs(position.longitude);
  const lonDeg = Math.floor(lon);
  const lonMin = ((lon - lonDeg) * 60).toFixed(3);
  const lonDir = position.longitude >= 0 ? 'E' : 'W';
  
  return `${latDeg}° ${latMin}' ${latDir} ${lonDeg.toString().padStart(3, '0')}° ${lonMin}' ${lonDir}`;
}

function calculateDistance(pos1, pos2) {
  if (!pos1 || !pos2 || !pos1.latitude || !pos1.longitude || !pos2.latitude || !pos2.longitude) return 0;
  
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
  const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatCourse(course) {
  if (!course && course !== 0) return "---";
  return `${Math.round(course).toString().padStart(3, '0')}°`;
}

function formatSpeed(speed) {
  if (!speed && speed !== 0) return "0.0";
  return speed.toFixed(1);
}

export default function Reports() {
  const [availableDays, setAvailableDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEntries, setDayEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/plugins/signalk-logbook/logs")
      .then(res => res.json())
      .then(days => {
        setAvailableDays(days.sort().reverse());
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching days:", err);
        setLoading(false);
      });
  }, []);

  const handleDaySelect = (day) => {
    setSelectedDay(day);
    // Fetch entries for the selected day
    fetch(`/plugins/signalk-logbook/logs/${day}`)
      .then(res => res.json())
      .then(entries => {
        // Process entries and add calculations
        const processedEntries = processEntriesForReport(entries);
        setDayEntries(processedEntries);
      })
      .catch(err => {
        console.error("Error fetching entries:", err);
        setDayEntries([]);
      });
  };

  const processEntriesForReport = (entries) => {
    if (!entries || entries.length === 0) return [];
    
    let cumulativeMotorDistance = 0;
    let cumulativeLogDistance = 0;
    
    return entries.map((entry, index) => {
      const prevEntry = index > 0 ? entries[index - 1] : null;
      let segmentDistance = 0;
      
      if (prevEntry && entry.position && prevEntry.position) {
        segmentDistance = calculateDistance(prevEntry.position, entry.position);
        
        // For work ships, all distance is under motor power
        cumulativeMotorDistance += segmentDistance;
        
        // Log distance could be different (from actual log readings if available)
        // For now, we'll use the same as motor distance
        cumulativeLogDistance += segmentDistance;
      }
      
      return {
        ...entry,
        time: new Date(entry.datetime).toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'UTC'
        }),
        formattedPosition: formatPosition(entry.position),
        course: entry.course || entry.heading || 0,
        sog: entry.speed?.sog || entry.speedOverGround || 0,
        segmentDistance: segmentDistance,
        cumulativeMotorDistance: cumulativeMotorDistance,
        cumulativeLogDistance: cumulativeLogDistance,
        barometer: entry.observations?.barometer || entry.barometer || "---",
        windSpeed: entry.wind?.speed || "---",
        windDirection: entry.wind?.direction || "---",
        seaState: entry.observations?.seaState || "---"
      };
      });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Card>
        <CardHeader><h4>Reports - Logbook Analysis</h4></CardHeader>
        <CardBody>
          <Row>
            <Col md={4}>
              <h5>Available Days</h5>
              <p>Select a day to view reports</p>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {availableDays.map((day) => (
                  <Card 
                    key={day} 
                    className={`mb-2 ${selectedDay === day ? "border-primary" : ""}`} 
                    style={{ cursor: "pointer" }} 
                    onClick={() => handleDaySelect(day)}
                  >
                    <CardBody className="py-2">
                      <div style={{ fontWeight: "bold" }}>{day}</div>
                      <small className="text-muted">Click to view report</small>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Col>
            <Col md={8}>
              {selectedDay ? (
                <div>
                  <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                    <h4 style={{ margin: '0', fontWeight: 'bold' }}>DATE: {new Date(selectedDay).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                    {dayEntries.length > 0 && (
                      <>
                        <div style={{ marginTop: '5px' }}>
                          <strong>FROM:</strong> {dayEntries[0]?.formattedPosition || "N/A"}
                        </div>
                        <div>
                          <strong>TO:</strong> {dayEntries[dayEntries.length - 1]?.formattedPosition || "N/A"}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {dayEntries.length > 0 ? (
                          <div style={{ overflowX: 'auto' }}>
                            {/* Main logbook table - Estonian Maritime format */}
                            <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '20px' }}>
                              <thead style={{ backgroundColor: '#f8f9fa' }}>
                                <tr>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Kellaaeg<br/>Time</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Tuule suund ja<br/>tugevus / Wind<br/>direction and<br/>velo city</th>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Lainetus<br/>Sea state</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Ilmastik ja<br/>nähtavus<br/>Weather and<br/>visibility</th>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Õhurõhk<br/>Air pressure</th>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Õhu temper.<br/>Air temper</th>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Vee temper.<br/>Water temper</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Lastiruumid<br/>Cargo holds</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Pilsivee võrra<br/>Bilge water<br/>level</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[1,2,3,4,5,6].map((rowNum) => {
                                  const entry = dayEntries[rowNum - 1];
                                  return (
                                    <tr key={rowNum}>
                                      <td style={{ textAlign: 'center' }}>{entry ? entry.time : ''}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.wind ? 
                                          `${Math.round(entry.wind.direction || 0)}° ${formatSpeed(entry.wind.speed || 0)}kn` : 
                                          ''}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations && entry.observations.seaState ? entry.observations.seaState : ''}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations ? 
                                          (entry.observations.visibility ? `☀️ Vis: ${entry.observations.visibility}` : '☀️ Good') : 
                                          ''}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations && entry.observations.barometer ? 
                                          `${entry.observations.barometer} mBar` : 
                                          ''}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations && entry.observations.airTemperature ? 
                                          `${entry.observations.airTemperature}°C` : 
                                          ''}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations && entry.observations.waterTemperature ? 
                                          `${entry.observations.waterTemperature}°C` : 
                                          ''}
                                      </td>
                                      <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>{rowNum}.</td>
                                      <td style={{ textAlign: 'center' }}>
                                        {entry && entry.observations && entry.observations.bilgeWater ? 
                                          `${entry.observations.bilgeWater}cm` : 
                                          ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>

                            {/* Middle section - Watch and passage */}
                            <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '20px' }}>
                              <thead style={{ backgroundColor: '#f8f9fa' }}>
                                <tr>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Kellaaeg<br/>Time</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Läbisõit<br/>Passage</th>
                                  <th style={{ textAlign: 'center', minWidth: '120px' }}>Vahitüürimees<br/>OOW (Officer of the watch)</th>
                                  <th style={{ textAlign: 'center', minWidth: '120px' }}>Vahimadrused<br/>Seaman of the watch</th>
                                </tr>
                                <tr>
                                  <th style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>9</th>
                                  <th style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>10</th>
                                  <th style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>11</th>
                                  <th style={{ textAlign: 'center', backgroundColor: '#f8f9fa' }}>12</th>
                                </tr>
                              </thead>
                              <tbody>
                                {['00:00', '06:00', '12:00', '18:00', ''].map((timeSlot, index) => {
                                  // Find entries around this time slot
                                  const timeEntries = dayEntries.filter(entry => {
                                    if (!timeSlot) return false;
                                    const entryHour = new Date(entry.datetime).getHours();
                                    const slotHour = parseInt(timeSlot.split(':')[0]);
                                    return Math.abs(entryHour - slotHour) <= 1; // Within 1 hour
                                  });
                                  
                                  const latestEntry = timeEntries.length > 0 ? timeEntries[timeEntries.length - 1] : null;
                                  const passageDistance = latestEntry ? formatSpeed(latestEntry.cumulativeMotorDistance || 0) : '';
                                  
                                  return (
                                    <tr key={index} style={{ height: '30px' }}>
                                      <td style={{ textAlign: 'center' }}>{timeSlot}</td>
                                      <td style={{ textAlign: 'center' }}>{passageDistance}</td>
                                      <td style={{ textAlign: 'center' }}>{latestEntry?.author || ''}</td>
                                      <td style={{ textAlign: 'center' }}>{latestEntry?.crew || latestEntry?.author || ''}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>

                            {/* 24 hour summary and voyage info */}
                            <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '20px' }}>
                              <tbody>
                                <tr>
                                  <td style={{ textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f8f9fa', padding: '5px' }}>
                                    Ööpäevas<br/>During 24 HRS
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', minWidth: '60px' }}>
                                    {formatSpeed(dayEntries[dayEntries.length - 1]?.cumulativeMotorDistance || 0)}
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa', minWidth: '40px' }}>13</td>
                                  <td style={{ textAlign: 'center', minWidth: '200px' }}>
                                    Navigatsioonitulede sisselülitamine<br/>
                                    <em>Switching on navigation lights</em>
                                  </td>
                                  <td style={{ textAlign: 'center', minWidth: '80px' }}>
                                    {(() => {
                                      // Find navigation light entries
                                      const navLightEntry = dayEntries.find(entry => 
                                        entry.text && entry.text.toLowerCase().includes('navigation') ||
                                        entry.text && entry.text.toLowerCase().includes('light')
                                      );
                                      return navLightEntry ? navLightEntry.time : '--:--';
                                    })()}
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f8f9fa', padding: '5px' }}>
                                    Reisi algusest/From<br/>the commencement<br/>of the voyage
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    {formatSpeed(dayEntries[dayEntries.length - 1]?.cumulativeMotorDistance || 0)}
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}></td>
                                  <td style={{ textAlign: 'center' }}>
                                    Navigatsioonitulede väljalülitamine<br/>
                                    <em>Switching off navigation lights</em>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {(() => {
                                      // Find navigation light off entries
                                      const navLightOffEntry = dayEntries.find(entry => 
                                        entry.text && (entry.text.toLowerCase().includes('light') && entry.text.toLowerCase().includes('off')) ||
                                        entry.text && entry.text.toLowerCase().includes('kustut')
                                      );
                                      return navLightOffEntry ? navLightOffEntry.time : '-';
                                    })()}
                                  </td>
                                </tr>
                              </tbody>
                            </Table>

                            {/* Section 14 - Fuel consumption section */}
                            <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '0' }}>
                              <tbody>
                                <tr>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa', minWidth: '40px' }}>14</td>
                                  <td colSpan={5} style={{ textAlign: 'center', padding: '10px', fontWeight: 'bold' }}>
                                    Laeva varustus / Ship's supplies
                                  </td>
                                </tr>
                              </tbody>
                            </Table>
                            <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '0' }}>
                              <thead style={{ backgroundColor: '#f8f9fa' }}>
                                <tr>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Diislikütus / Diesel fuel</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Raskes kütus / Heavy fuel</th>
                                  <th style={{ textAlign: 'center', minWidth: '80px' }}>Mage vesi / Fresh water</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ textAlign: 'center', padding: '5px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Kütuseid ööpäevas<br/>Consumption per day</div>
                                    <div style={{ marginBottom: '5px' }}></div>
                                    <div>Jääk<br/>Remainder</div>
                                    <div></div>
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '5px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Kütuseid ööpäevas<br/>Consumption per day</div>
                                    <div style={{ marginBottom: '5px' }}></div>
                                    <div>Jääk<br/>Remainder</div>
                                    <div></div>
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '5px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Kütuseid ööpäevas<br/>Consumption per day</div>
                                    <div style={{ marginBottom: '5px' }}></div>
                                    <div>Jääk<br/>Remainder</div>
                                    <div></div>
                                  </td>
                                </tr>
                              </tbody>
                            </Table>

                            {/* Tanks tracking */}
                            <Table bordered size="sm" style={{ fontSize: '10px', marginTop: '10px' }}>
                              <thead style={{ backgroundColor: '#f8f9fa' }}>
                                <tr>
                                  <th style={{ textAlign: 'center', minWidth: '60px' }}>Tankid / Tanks</th>
                                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(tankNum => (
                                    <th key={tankNum} style={{ textAlign: 'center', minWidth: '25px' }}>{tankNum}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Ballast vesi<br/>Ballast water</td>
                                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(tankNum => (
                                    <td key={tankNum} style={{ textAlign: 'center', height: '30px' }}></td>
                                  ))}
                                </tr>
                                <tr>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>Kütus<br/>Fuel</td>
                                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(tankNum => (
                                    <td key={tankNum} style={{ textAlign: 'center', height: '30px' }}></td>
                                  ))}
                                </tr>
                              </tbody>
                            </Table>

                            {/* Right Page - Timeline with Comments */}
                            <div style={{ marginTop: '30px', pageBreakBefore: 'always' }}>
                              <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                                <h4 style={{ margin: '0', fontWeight: 'bold', textAlign: 'center' }}>
                                  Logiraamatu kirjed / Logbook Timeline
                                </h4>
                                <div style={{ textAlign: 'center', marginTop: '5px', fontSize: '12px' }}>
                                  <strong>{new Date(selectedDay).toLocaleDateString('et-EE', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}</strong>
                                </div>
                              </div>

                              <Table bordered size="sm" style={{ fontSize: '11px', marginBottom: '0' }}>
                                <thead style={{ backgroundColor: '#f8f9fa' }}>
                                  <tr>
                                    <th style={{ textAlign: 'center', minWidth: '80px' }}>Kellaaeg<br/>Time</th>
                                    <th style={{ textAlign: 'left', minWidth: '400px' }}>Märkused ja tegevused<br/>Remarks and Activities</th>
                                    <th style={{ textAlign: 'center', minWidth: '80px' }}>Autor<br/>Author</th>
                                    <th style={{ textAlign: 'center', minWidth: '80px' }}>Kategooria<br/>Category</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dayEntries.map((entry, index) => (
                                    <tr key={index} style={{ 
                                      backgroundColor: entry.author === 'Automatic' ? '#f8f9fa' : 'white',
                                      borderLeft: entry.author === 'Automatic' ? '3px solid #007bff' : '3px solid #28a745'
                                    }}>
                                      <td style={{ 
                                        textAlign: 'center', 
                                        fontWeight: 'bold',
                                        verticalAlign: 'top',
                                        padding: '8px'
                                      }}>
                                        {entry.time}
                                      </td>
                                      <td style={{ 
                                        textAlign: 'left', 
                                        padding: '8px',
                                        lineHeight: '1.4'
                                      }}>
                                        <div style={{ marginBottom: '5px' }}>
                                          <strong>{entry.text || 'Automaatne kirje'}</strong>
                                        </div>
                                        {entry.position && (
                                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                                            📍 {entry.formattedPosition}
                                          </div>
                                        )}
                                        {entry.wind && entry.wind.speed && (
                                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                                            🌬️ Tuul: {Math.round(entry.wind.direction)}° {formatSpeed(entry.wind.speed)}kn
                                          </div>
                                        )}
                                        {entry.speed && entry.speed.sog && (
                                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                                            ⚡ Kiirus: {formatSpeed(entry.speed.sog)}kn
                                          </div>
                                        )}
                                        {entry.course && (
                                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                                            🧭 Kurss: {formatCourse(entry.course)}°
                                          </div>
                                        )}
                                        {entry.segmentDistance > 0 && (
                                          <div style={{ fontSize: '10px', color: '#666' }}>
                                            📏 Vahemaa: {formatSpeed(entry.segmentDistance)}NM (Kokku: {formatSpeed(entry.cumulativeMotorDistance)}NM)
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ 
                                        textAlign: 'center',
                                        verticalAlign: 'top',
                                        padding: '8px',
                                        fontSize: '10px'
                                      }}>
                                        {entry.author}
                                      </td>
                                      <td style={{ 
                                        textAlign: 'center',
                                        verticalAlign: 'top',
                                        padding: '8px'
                                      }}>
                                        {entry.category === 'navigation' ? '⚓' :
                                         entry.category === 'engine' ? '🔧' :
                                         entry.category === 'radio' ? '📡' : 
                                         entry.category === 'maintenance' ? '🔨' : '📝'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>

                              {/* Summary footer */}
                              <div style={{ 
                                marginTop: '20px', 
                                padding: '15px', 
                                backgroundColor: '#f8f9fa', 
                                border: '1px solid #dee2e6',
                                borderRadius: '5px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <strong>Päeva kokkuvõte / Daily Summary:</strong>
                                    <div style={{ fontSize: '12px', marginTop: '5px' }}>
                                      Kirjeid kokku: {dayEntries.length} | 
                                      Automaatseid: {dayEntries.filter(e => e.author === 'Automatic').length} | 
                                      Käsitsi: {dayEntries.filter(e => e.author !== 'Automatic').length}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div><strong>Läbitud vahemaa:</strong> {formatSpeed(dayEntries[dayEntries.length - 1]?.cumulativeMotorDistance || 0)} NM</div>
                                    <div style={{ fontSize: '12px', marginTop: '5px' }}>
                                      <strong>Kapten / Master:</strong> ________________
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                    </div>
                  ) : (
                    <p>No entries found for this day.</p>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d' }}>
                  <h5>Select a day from the left panel to view detailed report data.</h5>
                </div>
              )}
            </Col>
          </Row>
        </CardBody>
      </Card>
    </div>
  );
}
