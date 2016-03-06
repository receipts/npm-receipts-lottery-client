var options = require('config');
var updateTicketClient = require('../../lib/client/updateTicket');
var authClient = require('../../lib/client/auth');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('update ticket client test', function () {

  it('should update lottery ticket', function (done) {

    var id = '56db6006142877ae4d8bd1d5';

    var updateTicketRequest = {
      id: "56db6006142877ae4d8bd1d5",
      code: "FUP72DM1EAY",
      purchaseOrderNumber: "096750",
      amount: {currency: "PLN", value: "77.90"},
      date: "2016-03-04T23:00:00.798Z",
      special: false,
      pointOfSale: "bae13114086",
      taxRegistrationNumber: "5260207427",
      trade: "OTHER"
    };


    //var id = "563e50c6d323774c0b8b5a97";
    //
    //var updateTicketRequest =
    //{
    //  purchaseOrderNumber: "006754",
    //  amount: {currency: "PLN", value: "87.00"},
    //  date: "2016-03-06T23:00:00.785Z",
    //  special: true,
    //  pointOfSale: "BEC12189710",
    //  taxRegistrationNumber: "7861012333",
    //  trade: ""
    //};



    var authRequest = {
      email: "zz@wp.pl",
      password: "pass"
    };

    //authClient.authorizeUser(authRequest, options, function (err, jar) {
    //  //expect(jar).to.be.not.undefined;
    //
    //  updateTicketClient.updateLotteryTicket(jar, id, updateTicketRequest, options, function (err, data) {
    //    console.log(err, data);
    //    //expect(err).to.be.null;
    //    //expect(data).to.be.not.undefined;
        done();
    //  });
    //});
  });
});
