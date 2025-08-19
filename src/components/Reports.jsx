import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, Row, Col, Button } from "reactstrap";

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
      .then(entries => setDayEntries(entries))
      .catch(err => {
        console.error("Error fetching entries:", err);
        setDayEntries([]);
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
              <h5>Report Data</h5>
              {selectedDay ? (
                <div>
                  <p><strong>Selected Day:</strong> {selectedDay}</p>
                  <p><strong>Entries Found:</strong> {dayEntries.length}</p>
                  {dayEntries.length > 0 ? (
                    <div>
                      <h6>Summary:</h6>
                      <ul>
                        <li>Total entries: {dayEntries.length}</li>
                        <li>First entry: {dayEntries[0]?.datetime || "N/A"}</li>
                        <li>Last entry: {dayEntries[dayEntries.length - 1]?.datetime || "N/A"}</li>
                      </ul>
                    </div>
                  ) : (
                    <p>No entries found for this day.</p>
                  )}
                </div>
              ) : (
                <p>Select a day from the left panel to view detailed report data.</p>
              )}
            </Col>
          </Row>
        </CardBody>
      </Card>
    </div>
  );
}
