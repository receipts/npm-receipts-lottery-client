var util = require('util');
var extend = util._extend;
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var Currency = receiptsModel.enum.Currency;
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var TicketDetailsResponseBuilder = receiptsModel.model.ticketDetailsResponse.TicketDetailsResponseBuilder;
var AmountResponseBuilder = receiptsModel.model.amountResponse.AmountResponseBuilder;
var mainClient = require('./main');
var moment = require('moment-timezone');
var tradeConverter = require('../tradeConverter');

var getLotteryTicketRequest = function getLotteryTicketRequest(jar, token, id, getTicketRequestConfig, callback) {
  logger.debug('getLotteryTicketRequest');

  assert.string(token, 'token');
  assert.string(id, 'id');
  assert.object(getTicketRequestConfig, 'getTicketRequestConfig');
  assert.string(getTicketRequestConfig.url, 'getTicketRequestConfig.url');
  assert.object(getTicketRequestConfig.headers, 'getTicketRequestConfig.headers');
  assert.number(getTicketRequestConfig.timeout, 'getTicketRequestConfig.timeout');

  var headers = extend(getTicketRequestConfig.headers, {'x-csrf-token': token});
  var date = moment();
  var year = date.year();
  var month = date.month() + 1;

  var url = util.format('%s/%s/%d.%d', getTicketRequestConfig.url, id, month, year);

  var opt = {
    url: url,
    method: 'GET',
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
  var id = '';
  if ($('select#branza option:selected')) {
    if ($('select#branza option:selected').next().val()) {
      id = $('select#branza option:selected').next().val().trim();
    }
  }

  return tradeConverter.getTradeFromId(id);
};

var getAmountValue = function getAmountValue($) {
  var amount_01 = $('input#kwota_zl').val().trim();
  var amount_02 = $('input#kwota_gr').val().trim();

  if (!amount_02) {
    amount_02 = '00';
  }

  return amount_01 + '.' + amount_02;
};

var buildResponse = function buildResponse(body, id, callback) {
  assert.string(body, 'body');
  assert.string(id, 'id');

  var $ = cheerio.load(body);
  var code = getCode($);
  var purchaseOrderNumber = getPurchaseOrderNumber($);
  var taxRegistrationNumber = getNip($);
  var date = getDate($);
  var pointOfSale = getPointOfSale($);
  var trade = getTrade($);
  var amountValue = getAmountValue($);

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

  return mainClient.getMainPageData(jar, options, function (err, data) {
    if (err) {
      logger.error('getMainPageData returned with error: ', err);
      return callback(err);
    }

    var getTicketRequestConfig = options.get('get-ticket-request');
    assert.object(getTicketRequestConfig, 'getTicketRequestConfig');

    return getLotteryTicketRequest(jar, data.token, id, getTicketRequestConfig, function (err, body) {
      if (err) {
        logger.error('getLotteryTicketRequest returned with error: ', err);
        return callback(err);
      }

      return buildResponse(body, id, callback);
    });
  });
};

module.exports = {
  getLotteryTicketRequest: getLotteryTicketRequest,
  buildResponse: buildResponse,
  getLotteryTicket: getLotteryTicket
};