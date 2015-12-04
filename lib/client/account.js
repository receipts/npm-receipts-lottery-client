var async = require('async');
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;
var moment = require('moment-timezone');
var receiptIdRegex = /edytuj\/(.+)\/.*$/;

var MONTHS = [
  '10.2015',
  '11.2015',
  '12.2015',
  '01.2016',
  '02.2016',
  '03.2016',
  '04.2016',
  '05.2016',
  '06.2016',
  '07.2016',
  '08.2016',
  '09.2016',
  '10.2016'
];

var handleReceipts = function handleReceipts(jar, formConfig, callback) {
  logger.debug('handleReceipts');

  async.map(
    MONTHS,
    function (month, cb) {
      handleReceiptsForMonth(jar, month, formConfig, cb);
    },
    function (err, res) {
      if (err) {
        return callback(err);
      }

      res.reverse();

      var collection = [];

      for (var i = 0; i < res.length; ++i) {
        var monthRes = res[i];

        if (monthRes.length) {
          for (var j = 0; j < monthRes.length; ++j) {
            collection = collection.concat(monthRes[j]);
          }
        }
      }

      return callback(err, collection);
    }
  );

};

var handleReceiptsForMonth = function handleReceiptsForMonth(jar, month, formConfig, callback) {
  logger.debug('handleReceiptsForMonth', month);

  var collection = [];
  var page = 0;

  async.forever(
    function (cb) {
      page++;
      buildList(jar, month, page, formConfig, function (err, list) {
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

var buildList = function buildList(jar, month, page, formConfig, callback) {
  logger.debug('buildList', month, page);

  return getTicketsRequest(jar, month, page, formConfig, function (err, body) {

    if (err) {
      return callback(err);
    }

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
            receipt.code = text;
            break;
          case 4:
            receipt.id = null;
            var href = $('a.btn-edit', $(this)).attr('href');
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

var getTicketsRequest = function getTicketsRequest(jar, month, page, formConfig, callback) {
  logger.debug('getTicketsRequest', month, page);

  assert.number(page, 'page');
  assert.string(month, 'month');
  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.string(formConfig.url, 'formConfig.url');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  var url = formConfig.url + '?type=' + month + '&page=' + page;

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
  handleReceiptsForMonth: handleReceiptsForMonth,
  getTicketsRequest: getTicketsRequest,
  getTickets: getTickets
};