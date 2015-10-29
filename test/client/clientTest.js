var options = require('config');
var client = require('../../lib/client/client');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var request = require('request');
var jar = request.jar();
var requestWithJar = request.defaults({jar: jar});

describe('client test', function () {

  it('should prepareRequest', function (done) {

    var ticketRequest = {
      pointOfSale: "ban1002399111",
      purchaseOrderNumber: "073011",
      taxRegistrationNumber: "5090004311",
      phone: "123456789",
      date: "2015-10-02T00:00:00Z",
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

    client.prepareRequest(requestWithJar, jar, ticketRequest, options.get('form'), function (err, result) {
      result.should.have.deep.property('form.nr_kasy', 'ban1002399111');
      result.should.have.deep.property('form.nip', '5090004311');
      result.should.have.deep.property('form.nr_tel', '123456789');
      result.should.have.deep.property('form.rok', 2015);
      result.should.have.deep.property('form.miesiac', 10);
      result.should.have.deep.property('form.dzien', 2);
      result.should.have.deep.property('form.nr_wydruku', '073011');
      result.should.have.deep.property('form.kwota_zl', '1234');
      result.should.have.deep.property('form.kwota_gr', '56');
      result.should.have.deep.property('form.email', 'zzz@wp.pl');
      result.should.have.deep.property('form.branza', '');
      result.should.have.deep.property('form.zgoda_dane', true);
      result.should.have.deep.property('form.zgoda_wizerunek', false);
      expect(result.url).to.equal('https://loteriaparagonowa.gov.pl/paragon/stworz');
      expect(result.form.captcha).to.be.not.empty;
      expect(result.headers['x-csrf-token']).to.be.not.empty;
      done();
    });
  });

  //it('should sendReceipt', function (done) {
  //
  //  var ticketRequest = {
  //    pointOfSale: "ban1002399111",
  //    purchaseOrderNumber: "073011",
  //    taxRegistrationNumber: "5090004311",
  //    phone: "123456789",
  //    date: "2015-10-02T00:00:00Z",
  //    amount: "1234.56",
  //    trade: "",
  //    email: "zzz@wp.pl"
  //  };
  //
  //  client.lotteryTicket(ticketRequest, options, function (err, res) {
  //    console.log(err, res);
  //
  //    //expect(isExample).to.be.true;
  //    done();
  //  });
  //});


});
