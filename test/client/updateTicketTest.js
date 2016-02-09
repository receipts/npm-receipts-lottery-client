var options = require('config');
var updateTicketClient = require('../../lib/client/updateTicket');
var authClient = require('../../lib/client/auth');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('update ticket client test', function () {

  it('should update lottery ticket', function (done) {

    var updateTicketRequest = {
      pointOfSale: "bds12160186",
      purchaseOrderNumber: "78957",
      taxRegistrationNumber: "5260211104",
      date: "2016-02-01T00:00:00Z",
      amount: {
        value: "19.95",
        currency: "PLN"
      },
      trade: ""
    };

    var id = '56af34a214287718788b53d3';

    var authRequest = {
      email: "zz@wp.pl",
      password: "pass"
    };

    authClient.authorizeUser(authRequest, options, function (err, jar) {
      expect(jar).to.be.not.undefined;

      updateTicketClient.updateLotteryTicket(jar, id, updateTicketRequest, options, function (err, data) {
        console.log(err, data);
        //expect(err).to.be.null;
        //expect(data).to.be.not.undefined;
        done();
      });
    });
  });
});
