var extend = require('util')._extend;
var cheerio = require('cheerio');
var logger = require('./logger/logger').logger;
var receiptsModel = require('receipts-model');

var map = {
  '5602c71013287705788b4567': receiptsModel.enum.Brand.HAIRDRESSING,
  '5602c71013287705788b4568': receiptsModel.enum.Brand.PRIVATE_MEDIC_DENTAL,
  '': receiptsModel.enum.Brand.OTHER
};

var getTradeFromId = function getTradeFromId(id) {
  logger.debug('getTradeFromId: ' + id);

  if (map.hasOwnProperty(id)) {
    return map[id];
  }

  return receiptsModel.enum.Brand.OTHER;
};

var getIdFromTrade = function getIdFromTrade(trade) {
  logger.debug('getIdFromTrade: ' + trade);

  for (var id in map) {
    if (map[id] === trade) {
      return id;
    }
  }

  return '';
};


module.exports = {
  getTradeFromId: getTradeFromId,
  getIdFromTrade: getIdFromTrade
};