var assert = require('assert');
var request = require('supertest');
var appFactory = require('../app');

describe('smoke', function () {
  it('boots the app and loads the login page', function (done) {
    var app = appFactory.createApp();
    request(app)
      .get('/login')
      .expect(200)
      .expect(function (res) {
        assert.ok(res.text.indexOf('MyRiverbend') !== -1);
        assert.ok(res.text.indexOf('login-form') !== -1);
      })
      .end(done);
  });
});
