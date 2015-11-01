var meta = require('./lib/meta');
var logger = require('./lib/logger/logger').logger;
var ticketsClient = require('./lib/client/tickets');
var authClient = require('./lib/client/auth');

var sendLotteryTicket = function sendLotteryTicket(ticketRequest, options, callback) {
  logger.args('sendLotteryTicket:', arguments);
  return ticketsClient.sendLotteryTicket(ticketRequest, options, callback);
};

var authorizeUser = function authorizeUser(authRequest, options, callback) {
  logger.args('authorizeUser:', arguments);
  return authClient.authorizeUser(authRequest, options, callback);
};

module.exports = {
  VERSION: meta.VERSION,
  authorizeUser: authorizeUser,
  sendLotteryTicket: sendLotteryTicket
};