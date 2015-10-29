var meta = require('./lib/meta');
var logger = require('./lib/logger/logger').logger;
var client = require('./lib/client/client');

var lotteryTicket = function lotteryTicket(ticketRequest, options, callback) {
  logger.args('lotteryTicket:', arguments);
  return client.lotteryTicket(ticketRequest, options, callback);
};

module.exports = {
  VERSION: meta.VERSION,
  lotteryTicket: lotteryTicket
};