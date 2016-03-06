var options = require('config');
var getTicketClient = require('../../lib/client/getTicket');
var authClient = require('../../lib/client/auth');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('get ticket client test', function () {

  it('should get lottery ticket', function (done) {

    var id = '56db6006142877ae4d8bd1d5';
    //var id = '56d9ead3d32377747f8b8272';
    //var id = '563e50c6d323774c0b8b5a97';

    var authRequest = {
      email: "zz@wp.pl",
      password: "pass"
    };

    //authClient.authorizeUser(authRequest, options, function (err, jar) {
    //  expect(jar).to.be.not.undefined;
    //
    //  getTicketClient.getLotteryTicket(jar, id, options, function (err, data) {
    //    console.log(err, data);
    //    //expect(err).to.be.null;
    //    //expect(data).to.be.not.undefined;
        done();
    //  });
    //});
  });
});
