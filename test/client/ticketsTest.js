var options = require('config');
var ticketsClient = require('../../lib/client/tickets');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('tickets client test', function () {

  it('should send lottery ticket', function (done) {

    var ticketRequest = {
      pointOfSale: "ban1002399111",
      purchaseOrderNumber: "073011",
      taxRegistrationNumber: "8542174261",
      phone: "123456789",
      date: "2015-11-02T00:00:00Z",
      amount: {
        value: "1234.56",
        currency: "PLN"
      },
      trade: "",
      email: "zzz@wp.pl",
      agreements: {
        termsOfService: true,
        personalDataProcessing: true,
        useMyEffigy: false
      }
    };

    ticketsClient.sendLotteryTicket(ticketRequest, options, function (err, data) {
      console.log(err, data);
      //expect(err).to.be.null;
      //expect(data).to.be.not.undefined;
      done();
    });
  });


});
