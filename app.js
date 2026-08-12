var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var session = require('express-session');
var db = require('./lib/db');
var sync = require('./lib/sync');
var adminRoutes = require('./routes/admin');

function createApp() {
  var app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev',
    resave: false,
    saveUninitialized: false
  }));

  function requirePatient(req, res, next) {
    if (!req.session || !req.session.user || req.session.user.role !== 'patient') {
      return res.redirect('/login');
    }
    return next();
  }

  app.get('/', function (req, res) {
    if (req.session && req.session.user) {
      if (req.session.user.role === 'admin') return res.redirect('/admin');
      return res.redirect('/profile');
    }
    return res.redirect('/login');
  });

  app.get('/login', function (req, res) {
    res.render('login', { error: null });
  });

  app.post('/login', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    db.query('SELECT * FROM portal_users WHERE username = $1 AND password = $2', [username, password])
      .then(function (result) {
        if (!result.rows.length) {
          return res.render('login', { error: 'Invalid credentials' });
        }
        var user = result.rows[0];
        req.session.user = {
          username: user.username,
          role: user.role,
          patientId: user.patient_id
        };
        if (user.role === 'admin') {
          return res.redirect('/admin');
        }
        return sync.refreshPatient(user.patient_id).then(function () {
          res.redirect('/profile');
        }).catch(function () {
          // login-time refresh best-effort; still let them in on cache
          res.redirect('/profile');
        });
      }).catch(function (err) {
        res.status(500).send(err.message);
      });
  });

  app.get('/logout', function (req, res) {
    req.session.destroy(function () {
      res.redirect('/login');
    });
  });

  app.get('/profile', requirePatient, function (req, res) {
    db.query('SELECT * FROM portal_patients WHERE patient_id = $1', [req.session.user.patientId])
      .then(function (result) {
        res.render('profile', { patient: result.rows[0] || {} });
      }).catch(function (err) {
        res.status(500).send(err.message);
      });
  });

  app.get('/appointments', requirePatient, function (req, res) {
    res.render('appointments', {
      appointments: [
        { when: '08/18/2026 10:00 AM', clinic: 'Primary Care — Clarksville', provider: 'Dr. Nguyen' }
      ]
    });
  });

  app.get('/messages', requirePatient, function (req, res) {
    db.query('SELECT * FROM messages WHERE patient_id = $1 ORDER BY created_at DESC', [req.session.user.patientId])
      .then(function (result) {
        res.render('messages', { messages: result.rows });
      }).catch(function (err) {
        res.status(500).send(err.message);
      });
  });

  app.post('/messages', requirePatient, function (req, res) {
    var body = req.body.body || '';
    db.query('INSERT INTO messages (patient_id, body) VALUES ($1, $2)', [req.session.user.patientId, body])
      .then(function () {
        res.redirect('/messages');
      }).catch(function (err) {
        res.status(500).send(err.message);
      });
  });

  app.get('/request-visit', requirePatient, function (req, res) {
    var cadence = process.env.CADENCE_URL || 'http://localhost:5107/book';
    res.redirect(cadence + '?patientId=' + encodeURIComponent(req.session.user.patientId));
  });

  app.use('/admin', adminRoutes);

  return app;
}

module.exports = { createApp: createApp };
