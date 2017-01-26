'use strict';

const async = require('async');
const cheerio = require('cheerio');
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;
const moment = require('moment-timezone');
const receiptIdRegex = /(drukuj|edytuj)\/(.+)\/.*$/;

const MONTHS = [
  'special',
  '10.2015',
  '11.2015',
  '12.2015',
  '1.2016',
  '2.2016',
  '3.2016',
  '4.2016',
  '5.2016',
  '6.2016',
  '7.2016',
  '8.2016',
  '9.2016',
  '10.2016',
  '11.2016',
  '12.2016',
  '1.2017',
  '2.2017',
  '3.2017',
  '4.2017'
];

const getTicketsRequest = function getTicketsRequest(jar, month, page, formConfig, callback) {
  logger.debug('getTicketsRequest', month, page);

  assert.number(page, 'page');
  assert.string(month, 'month');
  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.string(formConfig.url, 'formConfig.url');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  const url = `${formConfig.url}?type=${month}&page=${page}`;

  const opt = {
    url: url,
    method: 'GET',
    rejectUnauthorized: false,
    followRedirect: true,
    headers: formConfig.headers,
//    gzip: true,
    jar: jar,
    timeout: formConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on getTicketsRequest: ', error);
        return callback(error);
      }

      switch (statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info(`Unauthorized access: ${statusCode}`);
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

const buildList = function buildList(jar, month, page, formConfig, callback) {
  logger.debug('buildList', month, page);

  return getTicketsRequest(jar, month, page, formConfig, (err, body) => {

    if (err) {
      return callback(err);
    }

    const receipts = [];
    const $ = cheerio.load(body);
    $('tr', '.table-responsive').each(function (/*i, tr*/) {
      let receipt = null;
      $('td', $(this)).each(function (j, td) {
        const text = $(this).text();

        switch (j) {
          case 0:
            receipt = {};
            receipt.id = null;
            receipt.special = 'special' === month;
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
          case 5:
            const href = $('a', td).attr('href');
            if (href && href.match(receiptIdRegex)) {
              receipt.id = href.match(receiptIdRegex)[2];
            }
            break;
          default:
        }
      });

      if (receipt) {
        receipts.push(receipt);
      }
    });

    return callback(null, receipts);
  });
};

const handleReceiptsForMonth = function handleReceiptsForMonth(jar, month, formConfig, callback) {
  logger.debug('handleReceiptsForMonth', month);

  let collection = [];
  let page = 0;

  return async.forever(
    cb => {
      page++;
      buildList(jar, month, page, formConfig, (err, list) => {
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
    err => callback(err)
  );

};

const handleReceipts = function handleReceipts(jar, formConfig, callback) {
  logger.debug('handleReceipts');

  return async.map(
    MONTHS,
    (month, cb) => {
      handleReceiptsForMonth(jar, month, formConfig, cb);
    },
    (err, res) => {
      if (err) {
        return callback(err);
      }

      res.reverse();

      let collection = [];

      for (let i = 0; i < res.length; ++i) {
        const monthRes = res[i];

        if (monthRes.length) {
          for (let j = 0; j < monthRes.length; ++j) {
            collection = collection.concat(monthRes[j]);
          }
        }
      }

      return callback(err, collection);
    }
  );

};


const getTickets = function getTickets(jar, options, callback) {
  assert.object(jar, 'jar');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  const receiptsFormConfig = options.get('account-request');
  return handleReceipts(jar, receiptsFormConfig, callback);
};

module.exports = {
  handleReceipts: handleReceipts,
  handleReceiptsForMonth: handleReceiptsForMonth,
  getTicketsRequest: getTicketsRequest,
  getTickets: getTickets
};