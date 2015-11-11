var extend = require('util')._extend;
var cheerio = require('cheerio');
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var AlreadyExistsError = receiptsModel.error.AlreadyExistsError;
var UnknownValidateError = receiptsModel.error.UnknownValidateError;
var InvalidPointOfSaleError = receiptsModel.error.InvalidPointOfSaleError;
var InvalidPurchaseOrderNumberError = receiptsModel.error.InvalidPurchaseOrderNumberError;
var InvalidDateError = receiptsModel.error.InvalidDateError;
var InvalidAmountError = receiptsModel.error.InvalidAmountError;
var InvalidTaxRegistrationNumberError = receiptsModel.error.InvalidTaxRegistrationNumberError;
var mainClient = require('./main');
var moment = require('moment-timezone');
var receiptIdRegex = /drukuj\/(.+)\/.*$/;

var buildForm = function buildForm(ticketRequest, captcha) {
  logger.debug('buildForm');

  ticketRequest.amount = ticketRequest.amount || '0.0';

  var date = moment(ticketRequest.date);

  var year = date.year();
  var month = date.month() + 1;
  var day = date.date();
  var amount = ticketRequest.amount.value.split('.');

  var trade = '';

  switch (ticketRequest.trade) {
    case receiptsModel.enum.Brand.HAIRDRESSING :
      trade = '5602c71013287705788b4567';
      break;
  }

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

var sendLotteryTicketRequest = function sendLotteryTicketRequest(jar, token, captcha, ticketRequest, ticketsRequestConfig, callback) {
  logger.debug('sendLotteryTicketRequest');

  assert.string(token, 'token');
  assert.number(captcha, 'captcha');
  assert.object(ticketRequest, 'ticketRequest');
  assert.object(ticketsRequestConfig, 'ticketsRequestConfig');
  assert.string(ticketsRequestConfig.url, 'ticketsRequestConfig.url');
  assert.object(ticketsRequestConfig.headers, 'ticketsRequestConfig.headers');
  assert.number(ticketsRequestConfig.timeout, 'ticketsRequestConfig.timeout');

  var headers = extend(ticketsRequestConfig.headers, {'x-csrf-token': token});
  var form = buildForm(ticketRequest, captcha);

  var opt = {
    url: ticketsRequestConfig.url,
    method: 'POST',
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: ticketsRequestConfig.timeout
  };

  try {
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on sendLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
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

var sendCaptchaRequest = function sendCaptchaRequest(jar, token, captcha, captchaRequestConfig, callback) {
  logger.debug('sendCaptchaRequest');

  assert.string(token, 'token');
  assert.number(captcha, 'captcha');
  assert.object(captchaRequestConfig, 'captchaRequestConfig');
  assert.object(captchaRequestConfig.headers, 'captchaRequestConfig.headers');
  assert.number(captchaRequestConfig.timeout, 'captchaRequestConfig.timeout');
  assert.string(captchaRequestConfig.url, 'captchaRequestConfig.url');

  var headers = extend(captchaRequestConfig.headers, {'x-csrf-token': token});
  var form = {captcha: captcha};

  var opt = {
    url: captchaRequestConfig.url,
    method: 'POST',
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: captchaRequestConfig.timeout
  };

  try {
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on sendLotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
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

var buildResponse = function buildResponse(body, callback) {
  assert.string(body, 'body');

  var json = JSON.parse(body);

  if (json.hasOwnProperty('success')) {

    if (!json.success) {

      if (json.message.indexOf('paragon fiskalny został już zgłoszony.') > -1) {
        return callback(new AlreadyExistsError('Ticket already exists', json.message));
      }

      return callback(new UnknownValidateError('Unable to validate parameters', json.message));
    }
    else {
      var $ = cheerio.load(json.message);

      var id = null;
      var code = $('.recipe-number', '.ty-form').text();
      $('div.links a').each(function (i, elem) {
        var href = $(this).attr('href');
        if (href && href.match(receiptIdRegex)) {
          id = href.match(receiptIdRegex)[1];
        }
      });

      var response = {
        id: id,
        code: code
      };

      return callback(null, response);
    }
  }
  else {
    if (json.hasOwnProperty('nr_kasy')) {
      return callback(new InvalidPointOfSaleError('Invalid pointOfSale number', json.nr_kasy.join(','), 'pointOfSale'));
    }

    if (json.hasOwnProperty('nr_wydruku')) {
      return callback(new InvalidPurchaseOrderNumberError('Invalid purchaseOrderNumber number', json.nr_wydruku.join(','), 'purchaseOrderNumber'));
    }

    if (json.hasOwnProperty('miesiac')) {
      return callback(new InvalidDateError('Invalid date', json.miesiac.join(','), 'date'));
    }

    if (json.hasOwnProperty('kwota_zl')) {
      return callback(new InvalidAmountError('Invalid amount value', json.kwota_zl.join(','), 'amount.value'));
    }

    if (json.hasOwnProperty('nip')) {
      if (json.nip.length > 1) {
        return callback(new InvalidTaxRegistrationNumberError('Invalid taxRegistrationNumber number', json.nip[1], 'taxRegistrationNumber'));
      }

      return callback(new InvalidTaxRegistrationNumberError('Invalid taxRegistrationNumber number', json.nip[0], 'taxRegistrationNumber'));
    }
  }

  return callback(new UnknownValidateError('Unknown validate exception'));
};

var sendLotteryTicket = function sendLotteryTicket(ticketRequest, options, callback) {
  assert.object(ticketRequest, 'ticketRequest');
  assert.object(options, 'options');

  var jar = request.jar();

  return mainClient.getMainPageData(jar, options, function (err, data) {
    if (err) {
      logger.error('getMainPageData returned with error: ', err);
      return callback(err);
    }

    var captchaRequestConfig = options.get('captcha-request');
    assert.object(captchaRequestConfig, 'captchaRequestConfig');

    var ticketsRequestConfig = options.get('tickets-request');
    assert.object(ticketsRequestConfig, 'ticketsRequestConfig');

    if (data.url) {
      ticketsRequestConfig.url = data.url;
    }

    sendCaptchaRequest(jar, data.token, data.captcha, captchaRequestConfig, function (err, captchBody) {
      if (err) {
        logger.error('sendCaptchaRequest returned with error: ', err);
        return callback(err);
      }

      if (captchBody !== 'true') {
        logger.error('sendCaptchaRequest invalid body: ', captchBody);
        return callback(new ServiceUnavailableError('Unable to send captcha'));
      }

      return sendLotteryTicketRequest(jar, data.token, data.captcha, ticketRequest, ticketsRequestConfig, function (err, body) {
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