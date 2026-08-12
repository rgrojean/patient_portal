var pg = require('pg');

require('dotenv').config();

var pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://portal:portal@localhost:15432/patient_portal'
});

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool: pool, query: query };
