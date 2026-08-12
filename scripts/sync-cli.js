require('dotenv').config();
var sync = require('../lib/sync');

sync.nightlySync().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
