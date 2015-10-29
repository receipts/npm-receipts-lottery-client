var extend = require('util')._extend;
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;

var moment = require('moment-timezone');
moment.tz.setDefault('Europe/Warsaw');

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
    kwota_gr: amount[1],
    email: ticketRequest.email,
    branza: trade,
    captcha: captcha,
    zgoda_dane: ticketRequest.agreements.termsOfService && ticketRequest.agreements.personalDataProcessing,
    zgoda_wizerunek: ticketRequest.agreements.useMyEffigy
  };

};

var reqex = function (body, re) {
  var res = null;
  while (res = re.exec(body)) {
    return res.length > 0 ? res[1].trim() : null;
  }

  return null;
};

var buildHeaders = function buildHeaders(body, formConfig) {
  logger.debug('buildHeaders');

  assert.string(body, 'body');
  assert.object(formConfig, 'formConfig');

  var headers = {};

  for (var fieldIndex in formConfig.fields) {
    if (formConfig.fields.hasOwnProperty(fieldIndex)) {
      var field = formConfig.fields[fieldIndex];
      var value = null;

      if (field.fieldRegex) {
        value = reqex(body, eval(field.fieldRegex));
      }

      if (value === null) {
        logger.debug('Failed to parse form param: ' + field.fieldName);
        throw new ServiceUnavailableError('Unable to prepare data');
      }

      headers[field.fieldName] = value;
    }
  }

  return headers;
};

var callMainPage = function callMainPage(requestWithJar, jar, formConfig, callback) {
  logger.debug('callMainPage');

  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  var options = {
    url: formConfig.url,
    method: 'GET',
    followRedirect: true,
    headers: formConfig.headers,
    jar: jar,
    timeout: formConfig.timeout
  };

  try {
    requestWithJar(options, function (error, response, body) {
      if (error) {
        logger.info('error on callMainPage: ', error);
        return callback(new ServiceUnavailableError('Unable to create receipt'));
      }

      return callback(error, body);
    });
  }
  catch (err) {
    logger.info('Unable to connect: %s', err);
    return callback(new ServiceUnavailableError('Unable to create receipt'));
  }
};

var removeTags = function removeTags(val) {
  var regex = /(<([^>]+)>)/ig;
  return val.replace(regex, '');
};


var prepareRequest = function prepareRequest(requestWithJar, jar, ticketRequest, formConfig, callback) {
  logger.debug('prepareRequest');

  assert.object(ticketRequest, 'ticketRequest');
  assert.object(formConfig, 'formConfig');

  callMainPage(requestWithJar, jar, formConfig, function (error, body) {

    if (error) {
      logger.error(error);
      return callback(error);
    }

    //TODO CONFIG
    var postUrlRegex = eval('/action=\"(http.+?' + formConfig.postUrlHost + '\\/paragon\\/stworz)\"/g');
    var parsedUrl = reqex(body, postUrlRegex);

    if (!parsedUrl) {
      return callback(new Error('Failed to parse form url'));
    }

    var url = parsedUrl;

    try {
      var headers = buildHeaders(body, formConfig);
      var form = buildForm(ticketRequest, eval(removeTags(headers.captcha)));
      return callback(error, {form: form, url: url, headers: headers});
    }
    catch (err) {
      logger.warn('prepareRequest failed: ' + err);
      return callback(err);
    }
  });
};


var lotteryTicketRequest = function lotteryTicketRequest(requestWithJar, jar, formData, formConfig, callback) {
  logger.debug('lotteryTicketRequest');

  assert.object(formData, 'formData');
  assert.string(formData.url, 'formData.url');
  assert.object(formConfig, 'formConfig');
  assert.object(formConfig.headers, 'formConfig.headers');
  assert.number(formConfig.timeout, 'formConfig.timeout');

  var headers = extend(formData.headers, formConfig.headers);

  var opt = {
    url: formData.url,
    method: 'POST',
    form: formData.form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: formConfig.timeout
  };

  try {
    requestWithJar(opt, function (error, response, body) {

      if (error) {
        logger.info('error on lotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
        case 302 :
          var location = response.headers.location;
          logger.debug('request for: ' + location);

          //override url for redirect
          opt.url = location;

          requestWithJar(opt, function (error, response, body) {
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

var sendCaptchaRequest = function sendCaptchaRequest(requestWithJar, jar, data, captchaConfig, callback) {
  logger.debug('sendCaptchaRequest');

  assert.object(data, 'data');
  assert.object(captchaConfig, 'captchaConfig');
  assert.object(captchaConfig.headers, 'captchaConfig.headers');
  assert.number(captchaConfig.timeout, 'captchaConfig.timeout');
  assert.string(captchaConfig.url, 'captchaConfig.url');

  var headers = extend(data.headers, captchaConfig.headers);
  var form = {captcha: data.form.captcha};

  var opt = {
    url: captchaConfig.url,
    method: 'POST',
    form: form,
    followRedirect: true,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: captchaConfig.timeout
  };

  try {
    requestWithJar(opt, function (error, response, body) {

      if (error) {
        logger.info('error on lotteryTicketRequest: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
        case 302 :
          var location = response.headers.location;
          logger.debug('request for: ' + location);

          //override url for redirect
          opt.url = location;

          requestWithJar(opt, function (error, response, body) {
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

var lotteryTicket = function (ticketRequest, options, callback) {
  assert.object(ticketRequest, 'ticketRequest');
  assert.object(options, 'options');

  var formConfig = options.get('form');
  var jar = request.jar();
  var requestWithJar = request.defaults({jar: jar});

  return prepareRequest(requestWithJar, jar, ticketRequest, formConfig, function (err, data) {
    if (err) {
      logger.error('prepareRequest returned with error: ', err);
      return callback(err);
    }

    var captchaConfig = options.get('captcha');

    sendCaptchaRequest(requestWithJar, jar, data, captchaConfig, function (err, body) {
      if (err) {
        logger.error('sendCaptchaRequest returned with error: ', err);
        return callback(err);
      }

      if (body !== 'true') {
        logger.error('sendCaptchaRequest invalid body: ', body);
        return callback(new ServiceUnavailableError('Unable to send captcha'));
      }

      return lotteryTicketRequest(requestWithJar, jar, data, formConfig, callback);
    });
  });
};

module.exports = {
  buildForm: buildForm,
  buildHeaders: buildHeaders,
  prepareRequest: prepareRequest,
  callMainPage: callMainPage,
  lotteryTicketRequest: lotteryTicketRequest,
  sendCaptchaRequest: sendCaptchaRequest,
  lotteryTicket: lotteryTicket
};