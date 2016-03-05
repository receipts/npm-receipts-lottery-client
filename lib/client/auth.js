'use strict';

var extend = require('util')._extend;
var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;
var clientMain = require('./main');

var buildForm = function buildForm(authRequest, token) {
  logger.debug('buildForm');

  return {
    email: authRequest.email,
    password: authRequest.password,
    _token: token
  };

};

var auth = function auth(jar, form, token, authRequestConfig, callback) {
  logger.debug('auth');

  assert.object(form, 'form');
  assert.object(authRequestConfig, 'authRequestConfig');
  assert.object(authRequestConfig.headers, 'authRequestConfig.headers');
  assert.string(authRequestConfig.url, 'authRequestConfig.url');
  assert.number(authRequestConfig.timeout, 'authRequestConfig.timeout');

  var headers = extend(authRequestConfig.headers, {'x-csrf-token': token});

  var opt = {
    url: authRequestConfig.url,
    method: 'POST',
    form: form,
    followRedirect: false,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: authRequestConfig.timeout
  };

  try {
    request(opt, function (error, response, body) {

      if (error) {
        logger.info('error on auth: ', error);
        return callback(error);
      }

      switch (response.statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info('Unauthorized access: ' + response.statusCode);
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

var authorizeUser = function authorizeUser(authRequest, options, callback) {
  assert.object(authRequest, 'authRequest');
  assert.object(options, 'options');

  var authFormConfig = options.get('auth-request');

  var jar = request.jar();

  return clientMain.getMainPageData(jar, options, function (error, mainData) {

    if (error) {
      logger.error(error);
      return callback(error);
    }

    var form = buildForm(authRequest, mainData.token);

    return auth(jar, form, mainData.token, authFormConfig, function (err, data) {
      if (err) {
        logger.error('auth returned with error: ', err);
        return callback(err);
      }

      var json = JSON.parse(data);

      if (json.hasOwnProperty('success') && json.success) {
        return callback(null, jar);
      }

      return callback(new UnauthorizedUserError('Unauthorized access'));
    });
  });
};

module.exports = {
  buildForm: buildForm,
  auth: auth,
  authorizeUser: authorizeUser
};