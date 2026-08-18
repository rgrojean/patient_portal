var assert = require('assert');
var sinon = require('sinon');
var db = require('../lib/db');
var sync = require('../lib/sync');
var fixtures = require('./fixtures/patients.json');

var v3Patient = fixtures.data[0];
var stansgarOnlyPatient = fixtures.data[1];

describe('sync', function () {
  var queryStub;

  beforeEach(function () {
    queryStub = sinon.stub(db, 'query').resolves({ rows: [] });
  });

  afterEach(function () {
    queryStub.restore();
  });

  it('upsertPatient maps v3 given[] and family onto cache name/family/given and does not read p.name', function () {
    return sync.upsertPatient(v3Patient).then(function () {
      assert.ok(queryStub.calledOnce);
      var sql = queryStub.firstCall.args[0];
      var params = queryStub.firstCall.args[1];
      assert.ok(sql.indexOf('given') !== -1);
      assert.ok(sql.indexOf('family') !== -1);
      assert.ok(sql.indexOf('ssn') === -1);
      assert.strictEqual(params[1], 'Williams, Sarah');
      assert.deepStrictEqual(params[2], ['Sarah']);
      assert.strictEqual(params[3], 'Williams');
    });
  });

  it('upsertPatient maps identifier[] urn:riverbend:mrn value to patient_id and does not read p.patientId', function () {
    return sync.upsertPatient(v3Patient).then(function () {
      var params = queryStub.firstCall.args[1];
      assert.strictEqual(params[0], '200104');
    });
  });

  it('upsertPatient skips and flags a patient that carries only a non-primary identifier system', function () {
    return sync.upsertPatient(stansgarOnlyPatient).then(function () {
      assert.fail('expected skip');
    }).catch(function (err) {
      assert.strictEqual(err.code, 'MISSING_RIVERBEND_MRN');
      assert.ok(queryStub.notCalled);
    });
  });

  it('upsertPatient succeeds when ssn is absent and does not persist ssn', function () {
    return sync.upsertPatient(v3Patient).then(function () {
      var sql = queryStub.firstCall.args[0];
      assert.ok(sql.indexOf('ssn') === -1);
    });
  });

  it('deriveDisplayName preserves v2 Last, First form', function () {
    assert.strictEqual(sync.deriveDisplayName(['Sarah'], 'Williams'), 'Williams, Sarah');
    assert.strictEqual(sync.deriveDisplayName(['Mary', 'Jane'], 'Smith'), 'Smith, Mary Jane');
  });

  it('extractRiverbendMrn returns null when only urn:stansgar:mrn is present', function () {
    assert.strictEqual(sync.extractRiverbendMrn(stansgarOnlyPatient), null);
  });

  it('extractRiverbendMrn selects urn:riverbend:mrn from identifier[]', function () {
    assert.strictEqual(sync.extractRiverbendMrn(v3Patient), '200104');
  });
});
