const ALLOWED_ENTRY_FIELDS = [
  'datetime', 'position', 'log', 'waypoint', 'heading', 'course', 'speed', 'barometer', 'wind',
  'observations', 'engine', 'vhf', 'crewNames', 'end', 'text', 'author', 'category'
];
function stripDisallowedFields(entry) {
  if (!entry) return entry;
  Object.keys(entry).forEach((key) => {
    if (!ALLOWED_ENTRY_FIELDS.includes(key)) {
      delete entry[key];
    }
  });
  return entry;
}
module.exports = { stripDisallowedFields, ALLOWED_ENTRY_FIELDS }; 