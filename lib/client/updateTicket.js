'use strict';

const util = require('util');
const extend = util._extend;
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const Trade = receiptsModel.enum.Trade;
const TicketNotFoundError = receiptsModel.error.TicketNotFoundError;
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const UnknownValidateError = receiptsModel.error.UnknownValidateError;
const InvalidPointOfSaleError = receiptsModel.error.InvalidPointOfSaleError;
const InvalidPurchaseOrderNumberError = receiptsModel.error.InvalidPurchaseOrderNumberError;
const InvalidDateError = receiptsModel.error.InvalidDateError;
const InvalidAmountError = receiptsModel.error.InvalidAmountError;
const InvalidTaxRegistrationNumberError = receiptsModel.error.InvalidTaxRegistrationNumberError;
const InvalidEmailError = receiptsModel.error.InvalidEmailError;
const InvalidPhoneError = receiptsModel.error.InvalidPhoneError;
const InvalidTradeError = receiptsModel.error.InvalidTradeError;
const mainClient = require('./main');
const moment = require('moment-timezone');

const buildForm = function buildForm(updateTicketRequest) {
  logger.debug('buildForm');

  assert.object(updateTicketRequest, 'updateTicketRequest');

  updateTicketRequest.amount = updateTicketRequest.amount || '0.0';

  const date = moment(updateTicketRequest.date);

  const year = date.year();
  const month = date.month() + 1;
  const day = date.date();
  const amount = updateTicketRequest.amount.value.split('.');
  const trade = Trade.getIdFromTrade(updateTicketRequest.trade);

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

const updateLotteryTicketRequest = function updateLotteryTicketRequest(jar, token, id, type, updateTicketRequest, updateTicketRequestConfig, callback) {
  logger.debug('updateLotteryTicketRequest');

  assert.string(token, 'token');
  assert.string(id, 'id');
  assert.string(type, 'type');
  assert.object(updateTicketRequest, 'updateTicketRequest');
  assert.object(updateTicketRequestConfig, 'updateTicketRequestConfig');
  assert.string(updateTicketRequestConfig.url, 'updateTicketRequestConfig.url');
  assert.object(updateTicketRequestConfig.headers, 'updateTicketRequestConfig.headers');
  assert.number(updateTicketRequestConfig.timeout, 'updateTicketRequestConfig.timeout');

  const headers = extend(updateTicketRequestConfig.headers, {'x-csrf-token': token});
  const form = buildForm(updateTicketRequest);

  const url = `${updateTicketRequestConfig.url}/${id}/${type}`;

  const opt = {
    url: url,
    method: 'POST',
    rejectUnauthorized: false,
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: updateTicketRequestConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on updateLotteryTicketRequest: ', error);
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

const buildResponse = function buildResponse(json, id, type, updateTicketRequest, callback) {
  assert.object(json, 'json');
  assert.string(id, 'id');
  assert.string(type, 'type');

  if (json.hasOwnProperty('success')) {

    if (!json.success) {

      if (json.hasOwnProperty('message')) {

        if (json.message.includes('loteria.receipts.special.2')) {
          return callback(new ServiceUnavailableError('Unable to update ticket (trade parameter)', 'Zmiana parametru \"branża\" jest w tym momencie nie możliwa'));
        }

        if (json.message.includes('No query results for model')) {
          return callback(new TicketNotFoundError(`Ticket "${id}" not found`));
        }
        if (json.message.includes('Trying to get property of non-object')) {
          return callback(new ServiceUnavailableError('Unable to update ticket', 'Nie możesz edytować danych wybranego paragonu'));
        }
      }

      return callback(new UnknownValidateError('Unable to validate parameters', json.message));
    }
    else {
      const special = 'special' === type;
      const response = extend(updateTicketRequest, {id: id, code: null, special: special});
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

const checkIfNotFound = function checkIfNotFound(json) {
  return (json.hasOwnProperty('success') && !json.success && json.hasOwnProperty('message') && json.message.includes('No query results for model'));
};

const updateLotteryTicket = function updateLotteryTicket(jar, id, updateTicketRequest, options, callback) {
  assert.object(jar, 'jar');
  assert.string(id, 'id');
  assert.object(updateTicketRequest, 'updateTicketRequest');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return mainClient.getMainPageData(jar, options, (mainErr, {token}) => {
    if (mainErr) {
      logger.error('getMainPageData returned with error: ', mainErr);
      return callback(mainErr);
    }

    const updateTicketRequestConfig = options.get('update-ticket-request');
    assert.object(updateTicketRequestConfig, 'updateTicketRequestConfig');

    const date = moment(updateTicketRequest.date);
    const year = date.year();
    const month = date.month() + 1;
    const type = util.format('%d.%d', month, year);

    return updateLotteryTicketRequest(jar, token, id, type, updateTicketRequest, updateTicketRequestConfig, (err, body) => {
      if (err) {
        logger.error('updateLotteryTicketRequest returned with error: ', err);
        return callback(err);
      }

      const json = JSON.parse(body);

      if (checkIfNotFound(json)) {

        //try with special
        const specialType = 'special';

        return updateLotteryTicketRequest(jar, token, id, specialType, updateTicketRequest, updateTicketRequestConfig, (specialErr, specialBody) => {
          if (specialErr) {
            logger.error('updateLotteryTicketRequest returned with error: ', specialErr);
            return callback(specialErr);
          }

          const specialJson = JSON.parse(specialBody);

          if (checkIfNotFound(specialJson)) {
            return callback(new TicketNotFoundError(`Ticket "${id}" not found`));
          }

          return buildResponse(specialJson, id, specialType, updateTicketRequest, callback);
        });

      }

      return buildResponse(json, id, type, updateTicketRequest, callback);
    });
  });
};

module.exports = {
  buildForm: buildForm,
  updateLotteryTicketRequest: updateLotteryTicketRequest,
  buildResponse: buildResponse,
  updateLotteryTicket: updateLotteryTicket
};