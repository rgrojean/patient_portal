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
    queryStub = sinon.stub(db, 'query').resolves({ rows: [] });
    getStub = sinon.stub(http, 'get');
  });

  afterEach(function () {
    queryStub.restore();
    getStub.restore();
  });

  it('upsertPatient maps v3 identifier array to portal_patients.patient_id', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.strictEqual(queryStub.firstCall.args[1][0], '200104');
    });
  });

  it('upsertPatient derives portal_patients.name from given[] and family', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      assert.strictEqual(queryStub.firstCall.args[1][1], 'Williams, Sarah');
    });
  });

  it('upsertPatient succeeds when ssn absent after schema migration', function () {
    return sync.upsertPatient(samplePatient).then(function () {
      var sql = queryStub.firstCall.args[0];
      var params = queryStub.firstCall.args[1];
      assert.ok(sql.indexOf('ssn') === -1);
      assert.strictEqual(params.length, 10);
    });
  });

  it('nightlySync upserts v3 patient payload end-to-end', function () {
    queryStub.onFirstCall().resolves({ rows: [{ patient_id: '200104' }] });
    getStub.resolves({ data: samplePatient });
    return sync.nightlySync().then(function () {
      assert.ok(getStub.calledOnce);
      assert.strictEqual(getStub.firstCall.args[0], process.env.PIS_URL + '/v2/patients/200104');
      assert.strictEqual(queryStub.secondCall.args[1][0], '200104');
      assert.strictEqual(queryStub.secondCall.args[1][1], 'Williams, Sarah');
    });
  });
});

describe('sync admin search compatibility', function () {
  var queryStub;
  var refreshStub;
  var request = require('supertest');
  var appFactory = require('../app');

  beforeEach(function () {
    process.env.CADENCE_URL = 'http://cadence.test/book';
    queryStub = sinon.stub(db, 'query');
    refreshStub = sinon.stub(sync, 'refreshPatient').resolves(samplePatient);
  });

  afterEach(function () {
    queryStub.restore();
    refreshStub.restore();
  });

  it('admin search matches patient by family name substring from v3-derived cache name', function (done) {
    var app = appFactory.createApp();
    var agent = request.agent(app);
    var cacheRow = {
      patient_id: samplePatient.identifier[0].value,
      name: samplePatient.family + ', ' + samplePatient.given.join(' '),
      dob: samplePatient.dob,
      gender: samplePatient.gender,
      phone: samplePatient.phone,
      email: samplePatient.email,
      addr_line1: samplePatient.address.line1,
      city: samplePatient.address.city,
      state: samplePatient.address.state,
      zip: samplePatient.address.zip
    };
    queryStub.onFirstCall().resolves({
      rows: [{ username: 'admin', password: 'admin', role: 'admin', patient_id: null }]
    });
    queryStub.onSecondCall().resolves({ rows: [cacheRow] });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/admin/search')
          .query({ name: 'Williams' })
          .expect(200)
          .expect(function (res) {
            assert.ok(res.text.indexOf('Williams, Sarah') !== -1);
          })
          .end(done);
      });
  });
});
