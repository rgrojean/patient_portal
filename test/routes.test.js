var assert = require('assert');
var request = require('supertest');
var sinon = require('sinon');
var db = require('../lib/db');
var sync = require('../lib/sync');
var appFactory = require('../app');
var fixtures = require('./fixtures/patients.json');

var samplePatient = fixtures.data[0];

function riverbendMrn(patient) {
  var i;
  for (i = 0; i < patient.identifier.length; i++) {
    if (patient.identifier[i].system === 'urn:riverbend:mrn') {
      return patient.identifier[i].value;
    }
  }
  return null;
}

function composedName(patient) {
  return patient.family + ', ' + patient.given.join(' ');
}

var cacheRow = {
  patient_id: riverbendMrn(samplePatient),
  name: composedName(samplePatient),
  dob: samplePatient.dob,
  gender: samplePatient.gender,
  phone: samplePatient.phone,
  email: samplePatient.email,
  addr_line1: samplePatient.address.line1,
  city: samplePatient.address.city,
  state: samplePatient.address.state,
  zip: samplePatient.address.zip
};

describe('routes', function () {
  var app;
  var queryStub;
  var refreshStub;

  beforeEach(function () {
    process.env.CADENCE_URL = 'http://cadence.test/book';
    queryStub = sinon.stub(db, 'query');
    refreshStub = sinon.stub(sync, 'refreshPatient').resolves(samplePatient);
    app = appFactory.createApp();
  });

  afterEach(function () {
    queryStub.restore();
    refreshStub.restore();
  });

  it('GET /login renders login page', function (done) {
    request(app)
      .get('/login')
      .expect(200)
      .expect(function (res) {
        assert.ok(res.text.indexOf('MyRiverbend') !== -1);
        assert.ok(res.text.indexOf('Sign in') !== -1);
      })
      .end(done);
  });

  it('GET / redirects anonymous users to login', function (done) {
    request(app)
      .get('/')
      .expect(302)
      .expect('Location', '/login')
      .end(done);
  });

  it('POST /login rejects bad credentials', function (done) {
    queryStub.resolves({ rows: [] });
    request(app)
      .post('/login')
      .type('form')
      .send({ username: 'nope', password: 'wrong' })
      .expect(200)
      .expect(function (res) {
        assert.ok(res.text.indexOf('Invalid credentials') !== -1);
      })
      .end(done);
  });

  it('POST /login as patient refreshes cache and redirects to profile', function (done) {
    queryStub.resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    request(app)
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .expect(302)
      .expect('Location', '/profile')
      .expect(function () {
        assert.ok(refreshStub.calledOnce);
        assert.strictEqual(refreshStub.firstCall.args[0], '200104');
      })
      .end(done);
  });

  it('POST /login as admin redirects to /admin', function (done) {
    queryStub.resolves({
      rows: [{ username: 'admin', password: 'admin', role: 'admin', patient_id: null }]
    });
    request(app)
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin' })
      .expect(302)
      .expect('Location', '/admin')
      .end(done);
  });

  it('GET /profile redirects when not logged in', function (done) {
    request(app)
      .get('/profile')
      .expect(302)
      .expect('Location', '/login')
      .end(done);
  });

  it('GET /profile renders dynamic patient fields from cache', function (done) {
    var agent = request.agent(app);
    queryStub.onFirstCall().resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    queryStub.onSecondCall().resolves({ rows: [cacheRow] });

    agent
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/profile')
          .expect(200)
          .expect(function (res) {
            assert.ok(res.text.indexOf('Date of Birth') !== -1);
            assert.ok(res.text.indexOf(cacheRow.dob) !== -1);
            assert.ok(res.text.indexOf('SSN') === -1);
            assert.ok(res.text.indexOf(cacheRow.name) !== -1);
            assert.ok(res.text.indexOf(cacheRow.patient_id) !== -1);
          })
          .end(done);
      });
  });

  it('GET /appointments shows upcoming appointments for patient', function (done) {
    var agent = request.agent(app);
    queryStub.resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/appointments')
          .expect(200)
          .expect(function (res) {
            assert.ok(res.text.indexOf('Upcoming Appointments') !== -1);
            assert.ok(res.text.indexOf('Request a visit') !== -1);
          })
          .end(done);
      });
  });

  it('GET /messages lists care-team messages', function (done) {
    var agent = request.agent(app);
    queryStub.onFirstCall().resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    queryStub.onSecondCall().resolves({
      rows: [{ id: 1, patient_id: '200104', body: 'Your lab results are ready.', created_at: '2026-01-01' }]
    });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/messages')
          .expect(200)
          .expect(function (res) {
            assert.ok(res.text.indexOf('Your lab results are ready.') !== -1);
          })
          .end(done);
      });
  });

  it('POST /messages inserts a message and redirects', function (done) {
    var agent = request.agent(app);
    queryStub.onFirstCall().resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    queryStub.onSecondCall().resolves({ rows: [] });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .post('/messages')
          .type('form')
          .send({ body: 'Hello care team' })
          .expect(302)
          .expect('Location', '/messages')
          .expect(function () {
            assert.ok(queryStub.secondCall.args[0].indexOf('INSERT INTO messages') !== -1);
          })
          .end(done);
      });
  });

  it('GET /request-visit hands off to Cadence URL', function (done) {
    var agent = request.agent(app);
    queryStub.resolves({
      rows: [{ username: 'swilliams', password: 'password', role: 'patient', patient_id: '200104' }]
    });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'swilliams', password: 'password' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/request-visit')
          .expect(302)
          .expect('Location', 'http://cadence.test/book?patientId=200104')
          .end(done);
      });
  });

  it('GET /admin redirects non-admin users', function (done) {
    request(app)
      .get('/admin')
      .expect(302)
      .expect('Location', '/login')
      .end(done);
  });

  it('GET /admin/search finds patients by name in local cache', function (done) {
    var agent = request.agent(app);
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
            assert.ok(res.text.indexOf('/admin/patients/200104') !== -1);
          })
          .end(done);
      });
  });

  it('GET /admin/patients/:id renders dynamic detail and writes audit_log', function (done) {
    var agent = request.agent(app);
    queryStub.onFirstCall().resolves({
      rows: [{ username: 'admin', password: 'admin', role: 'admin', patient_id: null }]
    });
    queryStub.onSecondCall().resolves({ rows: [cacheRow] });
    queryStub.onThirdCall().resolves({ rows: [] });
    agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin' })
      .end(function (err) {
        if (err) return done(err);
        agent
          .get('/admin/patients/200104')
          .expect(200)
          .expect(function (res) {
            assert.ok(res.text.indexOf('Date of Birth') !== -1);
            assert.ok(res.text.indexOf('SSN') === -1);
            assert.ok(res.text.indexOf(cacheRow.name) !== -1);
            assert.ok(queryStub.thirdCall.args[0].indexOf('INSERT INTO audit_log') !== -1);
            assert.deepStrictEqual(queryStub.thirdCall.args[1], ['admin', '200104']);
          })
          .end(done);
      });
  });
});
