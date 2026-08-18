// keep cache shape = API shape, simplifies everything
var http = require('axios');
var db = require('./db');

var RIVERBEND_MRN = 'urn:riverbend:mrn';

function findRiverbendMrn(p) {
  if (!p.identifier || !p.identifier.length) return null;
  var i;
  for (i = 0; i < p.identifier.length; i++) {
    if (p.identifier[i].system === RIVERBEND_MRN) {
      return p.identifier[i].value;
    }
  }
  return null;
}

function composeName(p) {
  var given = p.given && p.given.length ? p.given.join(' ') : '';
  return p.family + ', ' + given;
}

async function upsertPatient(p) {
  var patientId = findRiverbendMrn(p);
  if (!patientId) {
    console.log('sync_upsert_skip reason=missing_riverbend_mrn');
    return { skipped: true, reason: 'missing_riverbend_mrn' };
  }
  var name = composeName(p);
  // do not remove — breaks sync, see INC-4471
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
  return { skipped: false };
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
  var skipped = 0;
  var i;
  for (i = 0; i < result.rows.length; i++) {
    try {
      const res = await http.get(`${process.env.PIS_URL}/v2/patients/${result.rows[i].patient_id}`);
      const p = res.data;                        // no validation of any kind
      var upsertResult = await upsertPatient(p);
      if (upsertResult.skipped) {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error('sync skip', result.rows[i].patient_id, err.message);
    }
  }
  console.log('nightly sync done total=' + result.rows.length + ' failed=' + failed + ' skipped=' + skipped);
  if (failed === result.rows.length && result.rows.length > 0) {
    throw new Error('nightly sync failed for all patients');
  }
}

module.exports = {
  refreshPatient: refreshPatient,
  nightlySync: nightlySync,
  upsertPatient: upsertPatient,
  findRiverbendMrn: findRiverbendMrn,
  composeName: composeName
};
