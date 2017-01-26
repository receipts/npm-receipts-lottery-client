'use strict';

const extend = require('util')._extend;
const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const UnauthorizedUserError = receiptsModel.error.UnauthorizedUserError;
const clientMain = require('./main');

const buildForm = function buildForm(authRequest, token) {
  logger.debug('buildForm');

  return {
    email: authRequest.email,
    password: authRequest.password,
    _token: token
  };

};

const auth = function auth(jar, form, token, authRequestConfig, callback) {
  logger.debug('auth');

  assert.object(form, 'form');
  assert.object(authRequestConfig, 'authRequestConfig');
  assert.object(authRequestConfig.headers, 'authRequestConfig.headers');
  assert.string(authRequestConfig.url, 'authRequestConfig.url');
  assert.number(authRequestConfig.timeout, 'authRequestConfig.timeout');

  const headers = extend(authRequestConfig.headers, {'x-csrf-token': token});

  const opt = {
    url: authRequestConfig.url,
    method: 'POST',
    rejectUnauthorized: false,
    form: form,
    followRedirect: false,
    headers: headers,
//    gzip: true,
    jar: jar,
    timeout: authRequestConfig.timeout
  };

  try {
    return request(opt, (error, {statusCode}, body) => {

      if (error) {
        logger.info('error on auth: ', error);
        return callback(error);
      }

      switch (statusCode) {
        case 400 :
          logger.info('Unable to get data from service: status 400');
          return callback(new ServiceUnavailableError('Unable to get data from service'));
        case 401 :
        case 403 :
          logger.info(`Unauthorized access: ${statusCode}`);
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

const authorizeUser = function authorizeUser(authRequest, options, callback) {
  assert.object(authRequest, 'authRequest');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  const authFormConfig = options.get('auth-request');

  const jar = request.jar();

  return clientMain.getMainPageData(jar, options, (error, {token}) => {

    if (error) {
      logger.error(error);
      return callback(error);
    }

    const form = buildForm(authRequest, token);

    return auth(jar, form, token, authFormConfig, (err, data) => {
      if (err) {
        logger.error('auth returned with error: ', err);
        return callback(err);
      }

      const json = JSON.parse(data);

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