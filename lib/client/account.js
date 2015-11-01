var async = require('async');
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;
var moment = require('moment-timezone');
var receiptIdRegex = /edytuj\/(.+)$/;

var handleReceipts = function handleReceipts(jar, formConfig, callback) {
  logger.debug('handleReceipts');

  var collection = [];
  var page = 0;

  async.forever(
    function (cb) {
      page++;
      buildList(jar, page, formConfig, function (err, list) {

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

var buildList = function buildList(jar, page, formConfig, callback) {
  logger.debug('buildList', page);

  return getTicketsRequest(jar, page, formConfig, function (err, body) {
    var receipts = [];

    var $ = cheerio.load(body);
    $('tr', '.table-responsive').each(function (i, tr) {
      var receipt = null;
      $('td', $(this)).each(function (j, td) {
        var text = $(this).text();

        switch (j) {
          case 0:
            receipt = {};
            receipt.date = moment(text).seconds(0).minutes(0).hours(0).toISOString();
            break;
          case 1:
            receipt.amountValue = text;
            break;
          case 2:
            receipt.purchaseOrderNumber = text;
            break;
          case 3:
            receipt.num = text;
            break;
          case 4:
            receipt.id = null;
            var href = $('a', $(this)).attr('href');
            if (href && href.match(receiptIdRegex)) {
              receipt.id = href.match(receiptIdRegex)[1];
            }
            break;
        }
      });

      if (receipt) {
        receipts.push(receipt);
      }
    });

    return callback(null, receipts);
  });
};

var getTicketsRequest = function getTicketsRequest(jar, page, formConfig, callback) {
  logger.debug('getTicketsRequest');

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
        logger.info('error on getTicketsRequest: ', error);
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

var getTickets = function getTickets(jar, options, callback) {
  assert.object(jar, 'jar');
  assert.object(options, 'options');

  var receiptsFormConfig = options.get('account-request');
  return handleReceipts(jar, receiptsFormConfig, callback);
};

module.exports = {
  handleReceipts: handleReceipts,
  getTicketsRequest: getTicketsRequest,
  getTickets: getTickets
};