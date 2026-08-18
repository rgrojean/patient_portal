var assert = require('assert');
var sinon = require('sinon');
var http = require('axios');
var db = require('../lib/db');
var sync = require('../lib/sync');
var fixtures = require('./fixtures/patients.json');

var samplePatient = fixtures.data[0];

describe('sync', function () {
  var queryStub;
  var getStub;

  beforeEach(function () {
    process.env.PIS_URL = 'http://pis.test';
    queryStub = sinon.stub(db, 'query').resolves({ rows: [] });
    getStub = sinon.stub(http, 'get');
  });

  afterEach(function () {
    queryStub.restore();
    getStub.restore();
  });

  it('upsertPatient maps v3 identifier/given/family into portal_patients columns', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.ok(queryStub.calledOnce);
      var sql = queryStub.firstCall.args[0];
      var params = queryStub.firstCall.args[1];
      assert.ok(sql.indexOf('ssn') === -1);
      assert.strictEqual(params[0], '200104');
      assert.strictEqual(params[1], 'Williams, Sarah');
      assert.strictEqual(params[2], samplePatient.dob);
      assert.strictEqual(params[3], samplePatient.gender);
      assert.strictEqual(params[4], samplePatient.phone);
      assert.strictEqual(params[5], samplePatient.email);
      assert.strictEqual(params[6], samplePatient.address.line1);
      assert.strictEqual(params[7], samplePatient.address.city);
      assert.strictEqual(params[8], samplePatient.address.state);
      assert.strictEqual(params[9], samplePatient.address.zip);
    });
  });

  it('upsertPatient succeeds when v3 payload omits ssn', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.ok(queryStub.calledOnce);
      assert.ok(queryStub.firstCall.args[0].indexOf('ssn') === -1);
      assert.strictEqual(queryStub.firstCall.args[1].length, 10);
    });
  });

  it('refreshPatient integration against v3-shaped HTTP response', function () {
    getStub.resolves({ data: samplePatient });
    return sync.refreshPatient('200104').then(function (result) {
      assert.ok(getStub.calledOnce);
      assert.strictEqual(getStub.firstCall.args[0], 'http://pis.test/v2/patients/200104');
      assert.deepStrictEqual(result, samplePatient);
      assert.ok(queryStub.calledOnce);
      assert.strictEqual(queryStub.firstCall.args[1][0], '200104');
      assert.strictEqual(queryStub.firstCall.args[1][1], 'Williams, Sarah');
    });
  });
});
