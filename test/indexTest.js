var index = require('../index');
var options = require('config');
var chai = require('chai');
var should = chai.should();

describe('index test', function () {

  it('should export authorizeUser', function (done) {

    var authorizeUser = index.authorizeUser;
    should.exist(authorizeUser);
    done();
  });

  it('should export sendLotteryTicket', function (done) {

    var sendLotteryTicket = index.sendLotteryTicket;
    should.exist(sendLotteryTicket);
    done();
  });

  it('should export getTickets', function (done) {

    var getTickets = index.getTickets;
    should.exist(getTickets);
    done();
  });

  it('should export getResults', function (done) {

    var getResults = index.getResults;
    should.exist(getResults);
    done();
  });

  it('should export meta version', function (done) {

    var version = index.VERSION;
    should.exist(version);
    done();
  });
});