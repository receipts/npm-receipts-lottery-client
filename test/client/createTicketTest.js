var options = require('config');
var ticketsClient = require('../../lib/client/createTicket');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('create ticket client test', function () {

  it('should create lottery ticket', function (done) {

    var ticketRequest = {
      pointOfSale: "ban1102399111",
      purchaseOrderNumber: "013011",
      taxRegistrationNumber: "8542174261",
      phone: "123456789",
      date: "2016-03-02T00:00:00Z",
      amount: {
        value: "1234.56",
        currency: "PLN"
      },
      trade: "HAIRDRESSING",
      email: "zzz@wp.pl",
      agreements: {
        termsOfService: true,
        personalDataProcessing: true,
        useMyEffigy: false
      }
    };

    ticketsClient.sendLotteryTicket(ticketRequest, options, function (err, data) {
      //console.log(err, data);
      //expect(err).to.be.null;
      //expect(data).to.be.not.undefined;
      done();
    });
  });


});
