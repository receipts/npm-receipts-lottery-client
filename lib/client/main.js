'use strict';

var assert = require('assert-plus');
var request = require('request');
var logger = require('../logger/logger').logger;
var receiptsModel = require('receipts-model');
var ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
var cheerio = require('cheerio');

var getMainPage = function getMainPage(jar, options, callback) {
  logger.debug('getMainPage');
  var mainRequestConfig = options.get('main-request');

  assert.object(mainRequestConfig, 'mainRequestConfig');
  assert.object(mainRequestConfig.headers, 'mainRequestConfig.headers');
  assert.number(mainRequestConfig.timeout, 'mainRequestConfig.timeout');

  var opts = {
    url: mainRequestConfig.url,
    method: 'GET',
    rejectUnauthorized: false,
    followRedirect: true,
    headers: mainRequestConfig.headers,
    jar: jar,
    timeout: mainRequestConfig.timeout
  };

  try {
    request(opts, function (error, response, body) {
      if (error) {
        logger.info('error on getMainPage: ', error);
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


var getMainPageData = function getMainPageData(jar, options, callback) {
  logger.debug('getMainPageData');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return getMainPage(jar, options, function (error, body) {

    if (error) {
      logger.error(error);
      return callback(error);
    }

    var $ = cheerio.load(body);
    var url = $('form#registration-form').attr('action');
    var token = $('input#csrf-token').val();
    var captchaString = $('span#captcha-operation').text();
    var captcha = eval(captchaString);

    return callback(null, {url: url, token: token, captcha: captcha, captchaString: captchaString});
  });
};


module.exports = {
  getMainPage: getMainPage,
  getMainPageData: getMainPageData
};