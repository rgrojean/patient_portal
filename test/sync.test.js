var assert = require('assert');
var sinon = require('sinon');
var db = require('../lib/db');
var sync = require('../lib/sync');
var fixtures = require('./fixtures/patients.json');

var samplePatient = fixtures.data[0];

describe('sync upsertPatient', function () {
  var queryStub;
  var logStub;

  beforeEach(function () {
    queryStub = sinon.stub(db, 'query').resolves({ rows: [] });
    logStub = sinon.stub(console, 'error');
  });

  afterEach(function () {
    queryStub.restore();
    logStub.restore();
  });

  it('upsertPatient maps identifier.value for the v3 successor of v2 patientId onto portal_patients.patient_id', function () {
    return sync.upsertPatient(samplePatient, '200104').then(function () {
      assert.ok(queryStub.calledOnce);
      assert.strictEqual(queryStub.firstCall.args[1][0], '200104');
      var sql = queryStub.firstCall.args[0];
      assert.ok(sql.indexOf('INSERT INTO portal_patients') !== -1);
    });
  });

  it('upsertPatient skips when the record carries only a non-primary identifier system', function () {
    var patient = {
      identifier: [{ system: 'urn:stansgar:mrn', value: 'x' }],
      given: ['A'],
      family: 'B',
      dob: '01/01/2000',
      gender: 'F',
      phone: '0',
      email: null,
      address: { line1: '1', city: 'C', state: 'TN', zip: '0' }
    };
    return sync.upsertPatient(patient, '200104').then(function () {
      assert.ok(queryStub.notCalled);
      assert.ok(logStub.calledOnce);
      assert.strictEqual(logStub.firstCall.args[0], 'sync skip');
      assert.strictEqual(logStub.firstCall.args[1], '200104');
      assert.strictEqual(logStub.firstCall.args[2], 'missing_primary_identifier');
    });
  });

  it('upsertPatient composes cache name from family and given[] as family, given', function () {
    return sync.upsertPatient(samplePatient, '200104').then(function () {
      assert.ok(queryStub.calledOnce);
      assert.strictEqual(queryStub.firstCall.args[1][1], 'Williams, Sarah');
    });
  });

  it('upsertPatient succeeds when ssn is absent from the PIS body', function () {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(samplePatient, 'ssn'), false);
    return sync.upsertPatient(samplePatient, '200104').then(function () {
      assert.ok(queryStub.calledOnce);
      var sql = queryStub.firstCall.args[0];
      var binds = queryStub.firstCall.args[1];
      assert.ok(sql.indexOf('ssn') === -1);
      assert.ok(binds.indexOf(undefined) === -1);
    });
  });
});
