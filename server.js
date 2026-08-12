require('dotenv').config();
var appFactory = require('./app');

var port = process.env.PORT || 3107;
var app = appFactory.createApp();

app.listen(port, function () {
  console.log('MyRiverbend listening on ' + port);
});
