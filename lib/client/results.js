var async = require('async');
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;

var getResultsRequest = function getResultsRequest(jar, page, formConfig, callback) {
  logger.debug('getResultsRequest', page);

  assert.number(page, 'page');
  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.string(formConfig.url, 'formConfig.url');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  var url = formConfig.url + '?page=' + page;

  var opt = {
    url: url,
    method: 'GET',
    followRedirect: true,
    headers: formConfig.headers,
//    gzip: true,
    jar: jar,
    timeout: formConfig.timeout
  };

  try {
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on getResultsRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info('Unauthorized access: ' + response.statusCode);
          return callback(new UnauthorizedUserError('Unauthorized access'));
//      case 200 :
        default:
          return callback(null, body);
      }
    });
  }
  catch (err) {
    logger.info('Unable to connect: %s', err);
    return callback(new ServiceUnavailableError('Unable to authorize'));
  }
};

var buildList = function buildList(jar, page, formConfig, callback) {
  logger.debug('buildList', page);

  return getResultsRequest(jar, page, formConfig, function (err, body) {

    if (err) {
      return callback(err);
    }

    var receipts = [];
    var $ = cheerio.load(body);
    $('tr', 'div.results-table').each(function (/*i, tr*/) {
      var results = null;
      $('td', $(this)).each(function (j/*, td*/) {
        var text = $(this).text();

        switch (j) {
          case 0:
            results = {};
            results.date = text.trim();
            break;
          case 1:
            results.name = text.trim();
            break;
          case 2:
            results.code = text.trim();
            break;
          case 3:
            results.type = $('span', $(this)).text().trim();
            results.prize = $('div', $(this)).text().trim();
            break;
        }
      });

      if (results) {
        receipts.push(results);
      }
    });

    return callback(null, receipts);
  });
};


var handleResults = function handleResults(jar, formConfig, callback) {
  logger.debug('handleResults');

  var collection = [];
  var page = 0;

  async.forever(
    function (cb) {
      page++;
      buildList(jar, page, formConfig, function (err, list) {
        if (err) {
          return cb(err);
        }

        if (list && list.length > 0) {
          collection = collection.concat(list);
          return cb(null, list);
        }
        else {
          return callback(null, collection);
        }
      });
    },
    function (err) {
      return callback(err);
    }
  );

};

var getResults = function getResults(options, callback) {
  assert.object(options, 'options');

  var jar = request.jar();

  var receiptsFormConfig = options.get('results-request');

  return handleResults(jar, receiptsFormConfig, callback);
};

module.exports = {
  handleResults: handleResults,
  getResultsRequest: getResultsRequest,
  getResults: getResults
};