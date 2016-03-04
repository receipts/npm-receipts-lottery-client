var options = require('config');
var tradeConverter = require('../lib/tradeConverter');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('trade converter test', function () {

  it('should get trade from id', function (done) {
    var trade = tradeConverter.getTradeFromId('5602c71013287705788b4567');

    expect(trade).to.be.equal('HAIRDRESSING');
    done();
  });

  it('should get id from trade', function (done) {
    var id = tradeConverter.getIdFromTrade('PRIVATE_MEDIC_DENTAL');

    expect(id).to.be.equal('5602c71013287705788b4568');
    done();
  });
});
