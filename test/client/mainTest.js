var options = require('config');
var mainClient = require('../../lib/client/main');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var request = require('request');
var jar = request.jar();

describe('main client test', function () {

  it('should getMainPage', function (done) {

    mainClient.getMainPage(jar, options, function (err, body) {
      //console.log(err, body);
      expect(body).to.be.not.null;
      done();
    });
  });

  it('should getMainPageData', function (done) {

    mainClient.getMainPageData(jar, options, function (err, data) {
      // console.log(err, data);
      expect(data).to.be.not.null;
      expect(data.url).to.be.not.null;
      expect(data.token).to.be.not.null;
      expect(data.captcha).to.be.not.null;
      expect(data.captchaString).to.be.not.null;
      done();
    });
  });


});
