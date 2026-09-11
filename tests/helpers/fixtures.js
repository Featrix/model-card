const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', '..', 'examples');

function listFixtures() {
  return fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json')).sort();
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, name), 'utf8'));
}

module.exports = { EXAMPLES_DIR, listFixtures, loadFixture };
