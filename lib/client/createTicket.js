'use strict';

const extend = require('util')._extend;
const cheerio = require('cheerio');
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const Trade = receiptsModel.enum.Trade;
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const AlreadyExistsError = receiptsModel.error.AlreadyExistsError;
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
const receiptIdRegex = /drukuj\/(.+)\/.*$/;


const buildForm = function buildForm(ticketRequest, captcha) {
  logger.debug('buildForm');

  ticketRequest.amount = ticketRequest.amount || '0.0';

  const date = moment(ticketRequest.date);

  const year = date.year();
  const month = date.month() + 1;
  const day = date.date();
  const amount = ticketRequest.amount.value.split('.');
  const trade = Trade.getIdFromTrade(ticketRequest.trade);

  return {
    nr_kasy: ticketRequest.pointOfSale,
    nip: ticketRequest.taxRegistrationNumber,
    nr_tel: ticketRequest.phone,
    rok: year,
    miesiac: month,
    dzien: day,
    nr_wydruku: ticketRequest.purchaseOrderNumber,
    kwota_zl: amount[0],
    kwota_gr: amount[1] ? amount[1] : 0,
    email: ticketRequest.email,
    branza: trade,
    captcha: captcha,
    zgoda_dane: ticketRequest.agreements.termsOfService && ticketRequest.agreements.personalDataProcessing,
    zgoda_wizerunek: ticketRequest.agreements.useMyEffigy
  };

};

const sendLotteryTicketRequest = function sendLotteryTicketRequest(jar, token, captcha, ticketRequest, ticketsRequestConfig, callback) {
  logger.debug('sendLotteryTicketRequest');

  assert.string(token, 'token');
  assert.number(captcha, 'captcha');
  assert.object(ticketRequest, 'ticketRequest');
  assert.object(ticketsRequestConfig, 'ticketsRequestConfig');
  assert.string(ticketsRequestConfig.url, 'ticketsRequestConfig.url');
  assert.object(ticketsRequestConfig.headers, 'ticketsRequestConfig.headers');
  assert.number(ticketsRequestConfig.timeout, 'ticketsRequestConfig.timeout');

  const headers = extend(ticketsRequestConfig.headers, {'x-csrf-token': token});
  const form = buildForm(ticketRequest, captcha);

  const opt = {
    url: ticketsRequestConfig.url,
    method: 'POST',
    rejectUnauthorized: false,
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: ticketsRequestConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on sendLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
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

const sendCaptchaRequest = function sendCaptchaRequest(jar, token, captcha, captchaRequestConfig, callback) {
  logger.debug('sendCaptchaRequest');

  assert.string(token, 'token');
  assert.number(captcha, 'captcha');
  assert.object(captchaRequestConfig, 'captchaRequestConfig');
  assert.object(captchaRequestConfig.headers, 'captchaRequestConfig.headers');
  assert.number(captchaRequestConfig.timeout, 'captchaRequestConfig.timeout');
  assert.string(captchaRequestConfig.url, 'captchaRequestConfig.url');

  const headers = extend(captchaRequestConfig.headers, {'x-csrf-token': token});
  const form = {captcha: captcha};

  const opt = {
    url: captchaRequestConfig.url,
    method: 'POST',
    rejectUnauthorized: false,
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: captchaRequestConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on sendLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
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

const buildResponse = function buildResponse(body, callback) {
  assert.string(body, 'body');

  const json = JSON.parse(body);

  if (json.hasOwnProperty('success')) {

    if (!json.success) {

      if (json.message.includes('paragon fiskalny został już zgłoszony.')) {
        return callback(new AlreadyExistsError('Ticket already exists', json.message));
      }

      return callback(new UnknownValidateError('Unable to validate parameters', json.message));
    }
    else {
      const $ = cheerio.load(json.message);

      let id = null;
      const code = $('.recipe-number', '.ty-form').text();
      $('div.links a').each(function (/*i, elem*/) {
        const href = $(this).attr('href');
        if (href && href.match(receiptIdRegex)) {
          id = href.match(receiptIdRegex)[1];
        }
      });

      const response = {
        id: id,
        code: code
      };

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

const sendLotteryTicket = function sendLotteryTicket(ticketRequest, options, callback) {
  assert.object(ticketRequest, 'ticketRequest');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  const jar = request.jar();

  return mainClient.getMainPageData(jar, options, (mainErr, {url, token, captcha}) => {
    if (mainErr) {
      logger.error('getMainPageData returned with error: ', mainErr);
      return callback(mainErr);
    }

    const captchaRequestConfig = options.get('captcha-request');
    assert.object(captchaRequestConfig, 'captchaRequestConfig');

    let createTicketsRequestConfig = JSON.parse(JSON.stringify(options.get('create-ticket-request')));
    assert.object(createTicketsRequestConfig, 'createTicketsRequestConfig');

    if (url && createTicketsRequestConfig.url !== url) {
      createTicketsRequestConfig = extend(createTicketsRequestConfig, {url: url});
    }

    return sendCaptchaRequest(jar, token, captcha, captchaRequestConfig, (captchaErr, captchBody) => {
      if (captchaErr) {
        logger.error('sendCaptchaRequest returned with error: ', captchaErr);
        return callback(captchaErr);
      }

      if (captchBody !== 'true') {
        logger.error('sendCaptchaRequest invalid body: ', captchBody);
        return callback(new ServiceUnavailableError('Unable to send captcha'));
      }

      return sendLotteryTicketRequest(jar, token, captcha, ticketRequest, createTicketsRequestConfig, (err, body) => {
        if (err) {
          logger.error('sendLotteryTicketRequest returned with error: ', err);
          return callback(err);
        }

        return buildResponse(body, callback);
      });
    });
  });
};

module.exports = {
  buildForm: buildForm,
  sendLotteryTicketRequest: sendLotteryTicketRequest,
  sendCaptchaRequest: sendCaptchaRequest,
  buildResponse: buildResponse,
  sendLotteryTicket: sendLotteryTicket
};