var options = require('config');
var resultsClient = require('../../lib/client/results');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

describe('results client test', function () {

  it('should get results', function (done) {

    resultsClient.getResults(options, function (err, collection) {
      //console.log(err, collection);
      expect(err).to.not.be.an('undefined');
      expect(collection).to.be.an('array').that.is.not.empty;
      done();
    });
  });


});
