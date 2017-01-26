'use strict';

const util = require('util');
const extend = util._extend;
const cheerio = require('cheerio');
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const Trade = receiptsModel.enum.Trade;
const Currency = receiptsModel.enum.Currency;
const TicketNotFoundError = receiptsModel.error.TicketNotFoundError;
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const TicketDetailsResponseBuilder = receiptsModel.model.ticketDetailsResponse.TicketDetailsResponseBuilder;
const AmountResponseBuilder = receiptsModel.model.amountResponse.AmountResponseBuilder;
const mainClient = require('./main');
const moment = require('moment-timezone');

const getLotteryTicketRequest = function getLotteryTicketRequest(jar, token, id, type, getTicketRequestConfig, callback) {
  logger.debug('getLotteryTicketRequest');

  assert.string(token, 'token');
  assert.string(id, 'id');
  assert.string(type, 'type');
  assert.object(getTicketRequestConfig, 'getTicketRequestConfig');
  assert.string(getTicketRequestConfig.url, 'getTicketRequestConfig.url');
  assert.object(getTicketRequestConfig.headers, 'getTicketRequestConfig.headers');
  assert.number(getTicketRequestConfig.timeout, 'getTicketRequestConfig.timeout');

  const headers = extend(getTicketRequestConfig.headers, {'x-csrf-token': token});
  const url = `${getTicketRequestConfig.url}/${id}/${type}`;

  const opt = {
    url: url,
    method: 'GET',
    rejectUnauthorized: false,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: getTicketRequestConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on getLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info(`Unauthorized access: status: ${statusCode}, body: ${body}`);
          return callback(new ServiceUnavailableError('Unable to get data from service'));
//      case 200 :
        default:
          return callback(null, body);
      }
    });
  }
  catch (err) {
    logger.info('Unable to connect: %s', err);
    return callback(new ServiceUnavailableError('Unable to create receipt'));
  }
};

const getPointOfSale = function getPointOfSale($) {
  let pos = $('input#nr_kasy_1').val().trim();
  if (!pos || pos.length < 2) {
    pos = '';
    for (let i = 1; i < 14; ++i) {
      pos += $(`input#nr_kasy_${i}`).val().trim();
    }
  }

  return pos;
};

const getNip = function getNip($) {
  let nip = '';
  for (let i = 1; i < 11; ++i) {
    nip += $(`input#nip_${i}`).val().trim();
  }

  return nip;
};

const getCode = function getCode($) {
  return $('span#recipe-nr').text().trim();
};

const getDate = function getDate($) {
  const day = $('input#dzien').val().trim();

  return moment().date(day).seconds(0).minutes(0).hours(0).toISOString();
};

const getPurchaseOrderNumber = function getPurchaseOrderNumber($) {
  return $('input#nr_wydruku').val().trim();
};

const getTrade = function getTrade($) {
  let id = $('select#branza option').each(function (/*i, elem*/) {

    const selected = $(this).attr('selected');
    if (selected) {
      id = $(this).attr('value');
    }
  });

  return Trade.getTradeFromId(id);
};

const getAmountValue = function getAmountValue($) {
  const amount_01 = $('input#kwota_zl').val().trim();
  let amount_02 = $('input#kwota_gr').val().trim();

  if (!amount_02) {
    amount_02 = '00';
  }

  return `${amount_01}.${amount_02}`;
};

const checkIfNotFound = function checkIfNotFound(body) {
  return (body.includes('Whoops, looks like something went wrong.'));
};

const buildResponse = function buildResponse(body, id, type, callback) {
  assert.string(body, 'body');
  assert.string(id, 'id');
  assert.string(type, 'type');

  const $ = cheerio.load(body);
  const code = getCode($);
  const purchaseOrderNumber = getPurchaseOrderNumber($);
  const taxRegistrationNumber = getNip($);
  const date = getDate($);
  const pointOfSale = getPointOfSale($);
  const trade = getTrade($);
  const amountValue = getAmountValue($);
  const special = 'special' === type;

  const amount = new AmountResponseBuilder()
    .withCurrency(Currency.PLN)
    .withValue(amountValue)
    .build();

  const ticket = new TicketDetailsResponseBuilder()
    .withId(id)
    .withCode(code)
    .withPurchaseOrderNumber(purchaseOrderNumber)
    .withAmount(amount)
    .withDate(date)
    .withSpecial(special)
    .withPointOfSale(pointOfSale)
    .withTaxRegistrationNumber(taxRegistrationNumber)
    .withTrade(trade)
    .build();

  return callback(null, ticket);
};

const getLotteryTicket = function getLotteryTicket(jar, id, options, callback) {
  assert.object(jar, 'jar');
  assert.string(id, 'id');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return mainClient.getMainPageData(jar, options, (mainErr, {token}) => {
    if (mainErr) {
      logger.error('getMainPageData returned with error: ', mainErr);
      return callback(mainErr);
    }

    const getTicketRequestConfig = options.get('get-ticket-request');
    assert.object(getTicketRequestConfig, 'getTicketRequestConfig');

    const date = moment();
    const year = date.year();
    const month = date.month() + 1;

    const type = util.format('%d.%d', month, year);

    return getLotteryTicketRequest(jar, token, id, type, getTicketRequestConfig, (err, body) => {
      if (err) {
        logger.error('getLotteryTicketRequest returned with error: ', err);
        return callback(err);
      }

      if (checkIfNotFound(body)) {
        //try with special
        const specialType = 'special';

        return getLotteryTicketRequest(jar, token, id, specialType, getTicketRequestConfig, (specialErr, specialBody) => {
          if (specialErr) {
            logger.error('getLotteryTicketRequest returned with error: ', specialErr);
            return callback(specialErr);
          }

          if (checkIfNotFound(specialBody)) {
            return callback(new TicketNotFoundError(`Ticket "${id}" not found`));
          }

          return buildResponse(specialBody, id, specialType, callback);
        });
      }
      else {
        return buildResponse(body, id, type, callback);
      }
    });
  });
};

module.exports = {
  getLotteryTicketRequest: getLotteryTicketRequest,
  buildResponse: buildResponse,
  getLotteryTicket: getLotteryTicket
};