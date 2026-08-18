var assert = require('assert');
var sinon = require('sinon');
var db = require('../lib/db');
var sync = require('../lib/sync');
var fixtures = require('./fixtures/patients.json');

var samplePatient = fixtures.data[0];

describe('sync upsertPatient', function () {
  var queryStub;

  beforeEach(function () {
    queryStub = sinon.stub(db, 'query').resolves({ rows: [] });
  });

  afterEach(function () {
    queryStub.restore();
  });

  it('maps given[] and family to name as family + ", " + given.join(" ")', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.ok(queryStub.calledOnce);
      assert.strictEqual(queryStub.firstCall.args[1][1], 'Williams, Sarah');
    });
  });

  it('writes patient_id from identifier[] entry with system urn:riverbend:mrn', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.strictEqual(queryStub.firstCall.args[1][0], '200104');
    });
  });

  it('skips a patient whose identifier[] contains only urn:stansgar:mrn', function () {
    var patient = {
      identifier: [{ system: 'urn:stansgar:mrn', value: '999999' }],
      given: ['Test'],
      family: 'User',
      dob: '01/01/2000',
      gender: 'F',
      phone: '000-000-0000',
      email: 'test@example.com',
      address: { line1: '1 Main', city: 'Town', state: 'TN', zip: '00000' }
    };
    return sync.upsertPatient(patient).then(function (result) {
      assert.ok(queryStub.notCalled);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, 'missing_riverbend_mrn');
    });
  });

  it('succeeds when the PIS body has no ssn property', function () {
    return sync.upsertPatient(samplePatient).then(function (result) {
      assert.strictEqual(result.skipped, false);
      assert.ok(queryStub.calledOnce);
      var sql = queryStub.firstCall.args[0];
      assert.ok(sql.indexOf('ssn') === -1);
    });
  });
});
