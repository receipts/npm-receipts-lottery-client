'use strict';

const async = require('async');
const cheerio = require('cheerio');
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;

const getResultsRequest = function getResultsRequest(jar, page, formConfig, callback) {
  logger.debug('getResultsRequest', page);

  assert.number(page, 'page');
  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.string(formConfig.url, 'formConfig.url');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  const url = `${formConfig.url}?page=${page}`;

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
        logger.info('error on getResultsRequest: ', error);
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

const buildList = function buildList(jar, page, formConfig, callback) {
  logger.debug('buildList', page);

  return getResultsRequest(jar, page, formConfig, (err, body) => {

    if (err) {
      return callback(err);
    }

    const receipts = [];
    const $ = cheerio.load(body);
    $('tr', 'div.results-table').each(function (/*i, tr*/) {
      let results = null;
      $('td', $(this)).each(function (j/*, td*/) {
        const text = $(this).text();

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
          default :
        }
      });

      if (results) {
        receipts.push(results);
      }
    });

    return callback(null, receipts);
  });
};


const handleResults = function handleResults(jar, formConfig, callback) {
  logger.debug('handleResults');

  let collection = [];
  let page = 0;

  return async.forever(
    cb => {
      page++;
      buildList(jar, page, formConfig, (err, list) => {
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

const getResults = function getResults(options, callback) {
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  const jar = request.jar();

  const receiptsFormConfig = options.get('results-request');

  return handleResults(jar, receiptsFormConfig, callback);
};

module.exports = {
  handleResults: handleResults,
  getResultsRequest: getResultsRequest,
  getResults: getResults
};