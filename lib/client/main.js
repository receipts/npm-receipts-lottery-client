'use strict';

const assert = require('assert-plus');
const request = require('request');
const logger = require('../logger/logger').logger;
const receiptsModel = require('receipts-model');
const ServiceUnavailableError = receiptsModel.error.ServiceUnavailableError;
const cheerio = require('cheerio');

const getMainPage = function getMainPage(jar, options, callback) {
  logger.debug('getMainPage');
  const mainRequestConfig = options.get('main-request');

  assert.object(mainRequestConfig, 'mainRequestConfig');
  assert.object(mainRequestConfig.headers, 'mainRequestConfig.headers');
  assert.number(mainRequestConfig.timeout, 'mainRequestConfig.timeout');

  const opts = {
    url: mainRequestConfig.url,
    method: 'GET',
    rejectUnauthorized: false,
    followRedirect: true,
    headers: mainRequestConfig.headers,
    jar: jar,
    timeout: mainRequestConfig.timeout
  };

  try {
    return request(opts, (error, response, body) => {
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


const getMainPageData = function getMainPageData(jar, options, callback) {
  logger.debug('getMainPageData');
  assert.object(options, 'options');
  assert.func(callback, 'callback');

  return getMainPage(jar, options, (error, body) => {

    if (error) {
      logger.error(error);
      return callback(error);
    }

    const $ = cheerio.load(body);
    const url = $('form#registration-form').attr('action');
    const token = $('input#csrf-token').val();
    const captchaString = $('span#captcha-operation').text();
    const captcha = eval(captchaString);

    return callback(null, {url: url, token: token, captcha: captcha, captchaString: captchaString});
  });
};


module.exports = {
  getMainPage: getMainPage,
  getMainPageData: getMainPageData
};