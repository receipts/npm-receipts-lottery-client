var extend = require('util')._extend;
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var mainClient = require('./main');
var moment = require('moment-timezone');

var buildForm = function buildForm(ticketRequest, captcha) {
  logger.debug('buildForm');

  ticketRequest.amount = ticketRequest.amount || '0.0';

  var date = moment(ticketRequest.date);

  var year = date.year();
  var month = date.month() + 1;
  var day = date.date();
  var amount = ticketRequest.amount.value.split('.');

  var trade = '';

  //TODO ENUM
  switch (ticketRequest.trade) {
    case 'HAIRDRESSING' :
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
        case 302 :
          var location = response.headers.location;
          logger.debug('request for: ' + location);

          //override url for redirect
          opt.url = location;

          request(opt, function (error, response, body) {
            return callback(null, body);
          });

          break;
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
        case 302 :
          var location = response.headers.location;
          logger.debug('request for: ' + location);

          //override url for redirect
          opt.url = location;

          request(opt, function (error, response, body) {
            return callback(null, body);
          });

          break;
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

    sendCaptchaRequest(jar, data.token, data.captcha, captchaRequestConfig, function (err, body) {
      if (err) {
        logger.error('sendCaptchaRequest returned with error: ', err);
        return callback(err);
      }

      if (body !== 'true') {
        logger.error('sendCaptchaRequest invalid body: ', body);
        return callback(new ServiceUnavailableError('Unable to send captcha'));
      }

      return sendLotteryTicketRequest(jar, data.token, data.captcha, ticketRequest, ticketsRequestConfig, callback);
    });
  });
};

module.exports = {
  buildForm: buildForm,
  sendLotteryTicketRequest: sendLotteryTicketRequest,
  sendCaptchaRequest: sendCaptchaRequest,
  sendLotteryTicket: sendLotteryTicket
};