require('dotenv').config();

var fs = require('fs');
var path = require('path');
var db = require('./lib/db');

function migrate() {
  var dir = path.join(__dirname, 'migrations');
  var files = fs.readdirSync(dir).filter(function (f) {
    return f.slice(-4) === '.sql';
  }).sort();

  var i = 0;
  function next() {
    if (i >= files.length) {
      console.log('migrate ok');
      return db.pool.end();
    }
    var file = files[i++];
    var sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log('applying', file);
    return db.query(sql).then(next).catch(function (err) {
      console.error(err);
      process.exit(1);
    });
  }
  return next();
}

migrate();
