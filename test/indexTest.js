var index = require('../index');
var options = require('config');
var chai = require('chai');
var should = chai.should();

var body = '';

describe('index test', function () {

  it('should export lotteryTicket', function (done) {

    var lotteryTicket = index.lotteryTicket;
    should.exist(lotteryTicket);
    done();
  });

  it('should export meta version', function (done) {

    var version = index.VERSION;
    should.exist(version);
    done();
  });
});