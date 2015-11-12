var options = require('config');
var authClient = require('../../lib/client/auth');
var accountClient = require('../../lib/client/account');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('account client test', function () {

  //it('should get tickets', function (done) {
  //
  //  var authRequest = {
  //    email: "zz@wp.pl",
  //    password: "pass"
  //  };
  //
  //  authClient.authorizeUser(authRequest, options, function (err, jar) {
  //    expect(jar).to.be.not.undefined;
  //
  //    accountClient.getTickets(jar, options, function (err, collection) {
  //      console.log(collection);
  //      expect(err).to.be.not.undefined;
  //      expect(collection).to.be.not.empty;
  //      done();
  //    });
  //  });
  //});


});
