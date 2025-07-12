import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Table,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Alert,
} from 'reactstrap';

function Service(props) {
  const [availableDays, setAvailableDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEntries, setDayEntries] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);

  useEffect(() => {
    // Fetch available days
    fetch('/plugins/signalk-logbook/logs')
      .then((res) => res.json())
      .then((days) => {
        setAvailableDays(days.sort().reverse()); // Sort newest first
      })
      .catch((error) => {
        console.error('Error fetching days:', error);
      });
  }, []);

  function handleDaySelect(day) {
    setSelectedDay(day);
    // Fetch entries for the selected day
    fetch(`/plugins/signalk-logbook/logs/${day}`)
      .then((res) => res.json())
      .then((entries) => {
        setDayEntries(entries);
      })
      .catch((error) => {
        console.error('Error fetching entries:', error);
        setDayEntries([]);
      });
  }

  function handleDeleteDay() {
    if (!selectedDay) return;

    setDeleteStatus('deleting');
    
    // Delete all entries for the selected day
    fetch(`/plugins/signalk-logbook/logs/${selectedDay}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (res.ok) {
          setDeleteStatus('success');
          // Remove the day from available days
          setAvailableDays(availableDays.filter(day => day !== selectedDay));
          setSelectedDay(null);
          setDayEntries([]);
          // Trigger refresh in parent component
          if (props.onDataChange) {
            props.onDataChange();
          }
        } else {
          setDeleteStatus('error');
        }
      })
      .catch((error) => {
        console.error('Error deleting day:', error);
        setDeleteStatus('error');
      });
  }

  function formatDate(dayString) {
    const date = new Date(dayString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleTimeString('en-GB', {
      timeZone: props.displayTimeZone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <h4>Service - Log Management</h4>
          <p className="text-muted mb-0">
            Delete log entries by day. This action cannot be undone.
          </p>
        </CardHeader>
        <CardBody>
          {deleteStatus === 'success' && (
            <Alert color="success" onDismiss={() => setDeleteStatus(null)}>
              Day deleted successfully!
            </Alert>
          )}
          
          {deleteStatus === 'error' && (
            <Alert color="danger" onDismiss={() => setDeleteStatus(null)}>
              Error deleting day. Please try again.
            </Alert>
          )}

          <div className="row">
            <div className="col-md-6">
              <h5>Available Days</h5>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {availableDays.map((day) => (
                  <Card 
                    key={day} 
                    className={`mb-2 ${selectedDay === day ? 'border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleDaySelect(day)}
                  >
                    <CardBody className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{formatDate(day)}</strong>
                          <br />
                          <small className="text-muted">{day}</small>
                        </div>
                        {selectedDay === day && (
                          <Button 
                            color="danger" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteModal(true);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
                {availableDays.length === 0 && (
                  <p className="text-muted">No log entries found.</p>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <h5>Entries for Selected Day</h5>
              {selectedDay && dayEntries.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <Table size="sm">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Category</th>
                        <th>Text</th>
                        <th>Author</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEntries.map((entry) => (
                        <tr key={entry.datetime}>
                          <td>{formatTime(entry.datetime)}</td>
                          <td>
                            <span className={`badge bg-${entry.category === 'navigation' ? 'primary' : 
                                                   entry.category === 'engine' ? 'danger' : 
                                                   entry.category === 'radio' ? 'success' : 'secondary'}`}>
                              {entry.category}
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.text}
                            </div>
                          </td>
                          <td>{entry.author || 'auto'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : selectedDay ? (
                <p className="text-muted">No entries found for this day.</p>
              ) : (
                <p className="text-muted">Select a day to view entries.</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={showDeleteModal} toggle={() => setShowDeleteModal(false)}>
        <ModalHeader toggle={() => setShowDeleteModal(false)}>
          Confirm Delete
        </ModalHeader>
        <ModalBody>
          Are you sure you want to delete all log entries for <strong>{selectedDay ? formatDate(selectedDay) : ''}</strong>?
          <br />
          <br />
          This action cannot be undone and will permanently remove {dayEntries.length} log entries.
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={handleDeleteDay} disabled={deleteStatus === 'deleting'}>
            {deleteStatus === 'deleting' ? 'Deleting...' : 'Delete'}
          </Button>
          <Button color="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export default Service; 