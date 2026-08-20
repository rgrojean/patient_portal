var express = require('express');
var db = require('../lib/db');

var router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  return next();
}

router.use(requireAdmin);

router.get('/', function (req, res) {
  res.render('admin/lookup', { results: null, q: {} });
});

router.get('/search', function (req, res) {
  var name = req.query.name || '';
  var dob = req.query.dob || '';
  var sql = 'SELECT * FROM portal_patients WHERE 1=1';
  var params = [];
  if (name) {
    params.push('%' + name + '%');
    sql += ' AND (family ILIKE $' + params.length +
      ' OR EXISTS (SELECT 1 FROM unnest(COALESCE(given, ARRAY[]::TEXT[])) AS g WHERE g ILIKE $' + params.length + '))';
  }
  if (dob) {
    params.push(dob);
    sql += ' AND dob = $' + params.length;
  }
  db.query(sql, params).then(function (result) {
    res.render('admin/lookup', { results: result.rows, q: { name: name, dob: dob } });
  }).catch(function (err) {
    res.status(500).send(err.message);
  });
});

router.get('/patients/:id', function (req, res) {
  var patientId = req.params.id;
  db.query('SELECT * FROM portal_patients WHERE patient_id = $1', [patientId]).then(function (result) {
    if (!result.rows.length) {
      return res.status(404).send('Patient not found');
    }
    return db.query(
      'INSERT INTO audit_log (user_id, patient_id) VALUES ($1, $2)',
      [req.session.user.username, patientId]
    ).then(function () {
      res.render('admin/patient', { patient: result.rows[0] });
    });
  }).catch(function (err) {
    res.status(500).send(err.message);
  });
});

module.exports = router;
