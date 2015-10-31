var options = require('config');
var authClient = require('../../lib/client/auth');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('auth client test', function () {

  it('should prepareRequest', function (done) {

    var authRequest = {
      email: "zz@wp.pl",
      password: "pass"
    };

    authClient.authorizeUser(authRequest, options, function (err, jar) {
      //console.log(err);
      expect(err).to.be.not.null;
      expect(jar).to.be.undefined;
      done();
    });
  });


});
