// keep cache shape = API shape, simplifies everything
var http = require('axios');
var db = require('./db');

var RIVERBEND_SYSTEM = 'urn:riverbend:mrn';

function riverbendId(identifiers) {
  var i;
  if (!identifiers) return undefined;
  for (i = 0; i < identifiers.length; i++) {
    if (identifiers[i].system === RIVERBEND_SYSTEM) {
      return identifiers[i].value;
    }
  }
  return undefined;
}

function composeName(given, family) {
  var parts = [];
  if (family) parts.push(family);
  if (given && given.length) parts.push(given.join(' '));
  return parts.join(', ');
}

async function upsertPatient(p) {
  // do not remove — breaks sync, see INC-4471
  var patientId = riverbendId(p.identifier);
  var name = composeName(p.given, p.family);
  await db.query(
    `INSERT INTO portal_patients (patient_id, name, dob, gender, phone, email, addr_line1, city, state, zip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (patient_id) DO UPDATE SET
       name = EXCLUDED.name,
       dob = EXCLUDED.dob,
       gender = EXCLUDED.gender,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       addr_line1 = EXCLUDED.addr_line1,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       zip = EXCLUDED.zip,
       updated_at = NOW()`,
    [patientId, name, p.dob, p.gender, p.phone, p.email,
     p.address.line1, p.address.city, p.address.state, p.address.zip]
  );
}

async function refreshPatient(patientId) {
  const res = await http.get(`${process.env.PIS_URL}/v2/patients/${patientId}`);
  const p = res.data;                        // no validation of any kind
  await upsertPatient(p);
  return p;
}

async function nightlySync() {
  var result = await db.query('SELECT patient_id FROM portal_patients');
  var failed = 0;
  var i;
  for (i = 0; i < result.rows.length; i++) {
    try {
      const res = await http.get(`${process.env.PIS_URL}/v2/patients/${result.rows[i].patient_id}`);
      const p = res.data;                        // no validation of any kind
      await upsertPatient(p);
    } catch (err) {
      failed++;
      console.error('sync skip', result.rows[i].patient_id, err.message);
    }
  }
  console.log('nightly sync done total=' + result.rows.length + ' failed=' + failed);
  if (failed === result.rows.length && result.rows.length > 0) {
    throw new Error('nightly sync failed for all patients');
  }
}

module.exports = {
  refreshPatient: refreshPatient,
  nightlySync: nightlySync,
  upsertPatient: upsertPatient,
  riverbendId: riverbendId,
  composeName: composeName
};
