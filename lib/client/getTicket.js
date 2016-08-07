'use strict';

var util = require('util');
var extend = util._extend;
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var Trade = receiptsModel.enum.Trade;
var Currency = receiptsModel.enum.Currency;
var TicketNotFoundError = receiptsModel.error.TicketNotFoundError;
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var TicketDetailsResponseBuilder = receiptsModel.model.ticketDetailsResponse.TicketDetailsResponseBuilder;
var AmountResponseBuilder = receiptsModel.model.amountResponse.AmountResponseBuilder;
var mainClient = require('./main');
var moment = require('moment-timezone');

var getLotteryTicketRequest = function getLotteryTicketRequest(jar, token, id, type, getTicketRequestConfig, callback) {
  logger.debug('getLotteryTicketRequest');

  assert.string(token, 'token');
  assert.string(id, 'id');
  assert.string(type, 'type');
  assert.object(getTicketRequestConfig, 'getTicketRequestConfig');
  assert.string(getTicketRequestConfig.url, 'getTicketRequestConfig.url');
  assert.object(getTicketRequestConfig.headers, 'getTicketRequestConfig.headers');
  assert.number(getTicketRequestConfig.timeout, 'getTicketRequestConfig.timeout');

  var headers = extend(getTicketRequestConfig.headers, {'x-csrf-token': token});
  var url = util.format('%s/%s/%s', getTicketRequestConfig.url, id, type);

  var opt = {
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
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on getLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info('Unauthorized access: status: ' + response.statusCode + ', body: ' + body);
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

var getPointOfSale = function getPointOfSale($) {
  var pos = $('input#nr_kasy_1').val().trim();
  if (!pos || pos.length < 2) {
    pos = '';
    for (var i = 1; i < 14; ++i) {
      pos += $('input#nr_kasy_' + i).val().trim();
    }
  }

  return pos;
};

var getNip = function getNip($) {
  var nip = '';
  for (var i = 1; i < 11; ++i) {
    nip += $('input#nip_' + i).val().trim();
  }

  return nip;
};

var getCode = function getCode($) {
  return $('span#recipe-nr').text().trim();
};

var getDate = function getDate($) {
  var day = $('input#dzien').val().trim();

  return moment().date(day).seconds(0).minutes(0).hours(0).toISOString();
};

var getPurchaseOrderNumber = function getPurchaseOrderNumber($) {
  return $('input#nr_wydruku').val().trim();
};

var getTrade = function getTrade($) {
  var id = $('select#branza option').each(function (/*i, elem*/) {

    var selected = $(this).attr('selected');
    if (selected) {
      id = $(this).attr('value');
    }
  });

  return Trade.getTradeFromId(id);
};

var getAmountValue = function getAmountValue($) {
  var amount_01 = $('input#kwota_zl').val().trim();
  var amount_02 = $('input#kwota_gr').val().trim();

  if (!amount_02) {
    amount_02 = '00';
  }

  return amount_01 + '.' + amount_02;
};

var checkIfNotFound = function checkIfNotFound(body) {
  return (body.indexOf('Whoops, looks like something went wrong.') > -1);
};

var buildResponse = function buildResponse(body, id, type, callback) {
  assert.string(body, 'body');
  assert.string(id, 'id');
  assert.string(type, 'type');

  var $ = cheerio.load(body);
  var code = getCode($);
  var purchaseOrderNumber = getPurchaseOrderNumber($);
  var taxRegistrationNumber = getNip($);
  var date = getDate($);
  var pointOfSale = getPointOfSale($);
  var trade = getTrade($);
  var amountValue = getAmountValue($);
  var special = 'special' === type;

  var amount = new AmountResponseBuilder()
    .withCurrency(Currency.PLN)
    .withValue(amountValue)
    .build();

  var ticket = new TicketDetailsResponseBuilder()
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

var getLotteryTicket = function getLotteryTicket(jar, id, options, callback) {
  assert.object(jar, 'jar');
  assert.string(id, 'id');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return mainClient.getMainPageData(jar, options, function (mainErr, data) {
    if (mainErr) {
      logger.error('getMainPageData returned with error: ', mainErr);
      return callback(mainErr);
    }

    var getTicketRequestConfig = options.get('get-ticket-request');
    assert.object(getTicketRequestConfig, 'getTicketRequestConfig');

    var date = moment();
    var year = date.year();
    var month = date.month() + 1;

    var type = util.format('%d.%d', month, year);

    return getLotteryTicketRequest(jar, data.token, id, type, getTicketRequestConfig, function (err, body) {
      if (err) {
        logger.error('getLotteryTicketRequest returned with error: ', err);
        return callback(err);
      }

      if (checkIfNotFound(body)) {
        //try with special
        var specialType = 'special';

        return getLotteryTicketRequest(jar, data.token, id, specialType, getTicketRequestConfig, function (specialErr, specialBody) {
          if (specialErr) {
            logger.error('getLotteryTicketRequest returned with error: ', specialErr);
            return callback(specialErr);
          }

          if (checkIfNotFound(specialBody)) {
            return callback(new TicketNotFoundError('Ticket \"' + id + '\" not found'));
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