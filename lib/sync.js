// keep cache shape = API shape, simplifies everything
var http = require('axios');
var db = require('./db');

var RIVERBEND_MRN = 'urn:riverbend:mrn';

function extractRiverbendMrn(p) {
  if (!p.identifier || !p.identifier.length) {
    return null;
  }
  var i;
  for (i = 0; i < p.identifier.length; i++) {
    if (p.identifier[i].system === RIVERBEND_MRN) {
      return p.identifier[i].value;
    }
  }
  return null;
}

function deriveDisplayName(given, family) {
  if (family && given && given.length) {
    return family + ', ' + given.join(' ');
  }
  if (family) {
    return family;
  }
  if (given && given.length) {
    return given.join(' ');
  }
  return '';
}

async function upsertPatient(p) {
  // do not remove — breaks sync, see INC-4471
  var patientId = extractRiverbendMrn(p);
  if (!patientId) {
    var skipErr = new Error('missing_riverbend_mrn');
    skipErr.code = 'MISSING_RIVERBEND_MRN';
    throw skipErr;
  }
  var given = p.given || [];
  var family = p.family || '';
  var name = deriveDisplayName(given, family);
  await db.query(
    `INSERT INTO portal_patients (patient_id, name, given, family, dob, gender, phone, email, addr_line1, city, state, zip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (patient_id) DO UPDATE SET
       name = EXCLUDED.name,
       given = EXCLUDED.given,
       family = EXCLUDED.family,
       dob = EXCLUDED.dob,
       gender = EXCLUDED.gender,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       addr_line1 = EXCLUDED.addr_line1,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       zip = EXCLUDED.zip,
       updated_at = NOW()`,
    [patientId, name, given, family, p.dob, p.gender, p.phone, p.email,
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
      if (err.code === 'MISSING_RIVERBEND_MRN') {
        console.error('sync skip missing_riverbend_mrn');
      } else {
        console.error('sync skip', err.message);
      }
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
  extractRiverbendMrn: extractRiverbendMrn,
  deriveDisplayName: deriveDisplayName,
  RIVERBEND_MRN: RIVERBEND_MRN
};
