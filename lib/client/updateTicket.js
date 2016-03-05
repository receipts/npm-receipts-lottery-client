'use strict';

var util = require('util');
var extend = util._extend;
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var UnknownValidateError = receiptsModel.error.UnknownValidateError;
var InvalidPointOfSaleError = receiptsModel.error.InvalidPointOfSaleError;
var InvalidPurchaseOrderNumberError = receiptsModel.error.InvalidPurchaseOrderNumberError;
var InvalidDateError = receiptsModel.error.InvalidDateError;
var InvalidAmountError = receiptsModel.error.InvalidAmountError;
var InvalidTaxRegistrationNumberError = receiptsModel.error.InvalidTaxRegistrationNumberError;
var InvalidEmailError = receiptsModel.error.InvalidEmailError;
var InvalidPhoneError = receiptsModel.error.InvalidPhoneError;
var InvalidTradeError = receiptsModel.error.InvalidTradeError;
var mainClient = require('./main');
var moment = require('moment-timezone');

var buildForm = function buildForm(updateTicketRequest) {
  logger.debug('buildForm');

  assert.object(updateTicketRequest, 'updateTicketRequest');

  updateTicketRequest.amount = updateTicketRequest.amount || '0.0';

  var date = moment(updateTicketRequest.date);

  var year = date.year();
  var month = date.month() + 1;
  var day = date.date();
  var amount = updateTicketRequest.amount.value.split('.');

  var trade = '';

  switch (updateTicketRequest.trade) {
    case receiptsModel.enum.Trade.HAIRDRESSING :
      trade = '5602c71013287705788b4567';
      break;
    case receiptsModel.enum.Trade.PRIVATE_MEDIC_DENTAL :
      trade = '5602c71013287705788b4568';
      break;
    default:
  }

  return {
    nr_kasy: updateTicketRequest.pointOfSale,
    nip: updateTicketRequest.taxRegistrationNumber,
    nr_tel: updateTicketRequest.phone,
    rok: year,
    miesiac: month,
    dzien: day,
    nr_wydruku: updateTicketRequest.purchaseOrderNumber,
    kwota_zl: amount[0],
    kwota_gr: amount[1] ? amount[1] : 0,
    branza: trade
  };

};

var updateLotteryTicketRequest = function updateLotteryTicketRequest(jar, token, id, updateTicketRequest, updateTicketRequestConfig, callback) {
  logger.debug('updateLotteryTicketRequest');

  assert.string(token, 'token');
  assert.string(id, 'id');
  assert.object(updateTicketRequest, 'updateTicketRequest');
  assert.object(updateTicketRequestConfig, 'updateTicketRequestConfig');
  assert.string(updateTicketRequestConfig.url, 'updateTicketRequestConfig.url');
  assert.object(updateTicketRequestConfig.headers, 'updateTicketRequestConfig.headers');
  assert.number(updateTicketRequestConfig.timeout, 'updateTicketRequestConfig.timeout');

  var headers = extend(updateTicketRequestConfig.headers, {'x-csrf-token': token});
  var form = buildForm(updateTicketRequest);

  var date = moment(updateTicketRequest.date);
  var year = date.year();
  var month = date.month() + 1;

  var url = util.format('%s/%s/%d.%d', updateTicketRequestConfig.url, id, month, year);

  var opt = {
    url: url,
    method: 'POST',
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: updateTicketRequestConfig.timeout
  };

  try {
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on updateLotteryTicketRequest: ', error);
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

var buildResponse = function buildResponse(body, id, updateTicketRequest, callback) {
  assert.string(body, 'body');

  var json = JSON.parse(body);

  if (json.hasOwnProperty('success')) {

    if (!json.success) {
      if (json.hasOwnProperty('message') && json.message.indexOf('loteria.receipts.special.2') > -1) {
        return callback(new ServiceUnavailableError('Unable to update ticket (trade parameter)', 'Zmiana parametru \"branża\" jest w tym momencie nie możliwa'));
      }

      return callback(new UnknownValidateError('Unable to validate parameters', json.message));
    }
    else {
      var response = extend(updateTicketRequest, {id: id, code: null});
      return callback(null, response);
    }
  }
  else {
    if (json.hasOwnProperty('nr_kasy')) {
      return callback(new InvalidPointOfSaleError('Invalid pointOfSale value', json.nr_kasy.join(','), 'pointOfSale'));
    }

    if (json.hasOwnProperty('email')) {
      return callback(new InvalidEmailError('Invalid email value', json.email.join(','), 'email'));
    }

    if (json.hasOwnProperty('nr_tel')) {
      return callback(new InvalidPhoneError('Invalid phone value', json.nr_tel.join(','), 'phone'));
    }

    if (json.hasOwnProperty('nr_wydruku')) {
      return callback(new InvalidPurchaseOrderNumberError('Invalid purchaseOrderNumber value', json.nr_wydruku.join(','), 'purchaseOrderNumber'));
    }

    if (json.hasOwnProperty('miesiac')) {
      return callback(new InvalidDateError('Invalid date value', json.miesiac.join(','), 'date'));
    }

    if (json.hasOwnProperty('kwota_zl')) {
      return callback(new InvalidAmountError('Invalid amount value', json.kwota_zl.join(','), 'amount.value'));
    }

    if (json.hasOwnProperty('branza')) {
      return callback(new InvalidTradeError('Invalid trade value', json.branza.join(','), 'trade'));
    }

    if (json.hasOwnProperty('nip')) {
      if (json.nip.length > 1) {
        return callback(new InvalidTaxRegistrationNumberError('Invalid taxRegistrationNumber value', json.nip[1], 'taxRegistrationNumber'));
      }

      return callback(new InvalidTaxRegistrationNumberError('Invalid taxRegistrationNumber value', json.nip[0], 'taxRegistrationNumber'));
    }
  }

  return callback(new UnknownValidateError('Unknown validate exception'));
};

var updateLotteryTicket = function updateLotteryTicket(jar, id, updateTicketRequest, options, callback) {
  assert.object(jar, 'jar');
  assert.string(id, 'id');
  assert.object(updateTicketRequest, 'updateTicketRequest');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return mainClient.getMainPageData(jar, options, function (mainErr, data) {
    if (mainErr) {
      logger.error('getMainPageData returned with error: ', mainErr);
      return callback(mainErr);
    }

    var updateTicketRequestConfig = options.get('update-ticket-request');
    assert.object(updateTicketRequestConfig, 'updateTicketRequestConfig');

    return updateLotteryTicketRequest(jar, data.token, id, updateTicketRequest, updateTicketRequestConfig, function (err, body) {
      if (err) {
        logger.error('updateLotteryTicketRequest returned with error: ', err);
        return callback(err);
      }

      return buildResponse(body, id, updateTicketRequest, callback);
    });
  });
};

module.exports = {
  buildForm: buildForm,
  updateLotteryTicketRequest: updateLotteryTicketRequest,
  buildResponse: buildResponse,
  updateLotteryTicket: updateLotteryTicket
};