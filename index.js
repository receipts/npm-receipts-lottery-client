var meta = require('./lib/meta');
var logger = require('./lib/logger/logger').logger;
var ticketsClient = require('./lib/client/tickets');
var accountClient = require('./lib/client/account');
var authClient = require('./lib/client/auth');

var sendLotteryTicket = function sendLotteryTicket(ticketRequest, options, callback) {
  return ticketsClient.sendLotteryTicket(ticketRequest, options, callback);
};

var authorizeUser = function authorizeUser(authRequest, options, callback) {
  return authClient.authorizeUser(authRequest, options, callback);
};

var getTickets = function getTickets(jar, options, callback) {
  return accountClient.getTickets(jar, options, callback);
};

module.exports = {
  VERSION: meta.VERSION,
  authorizeUser: authorizeUser,
  sendLotteryTicket: sendLotteryTicket,
  getTickets: getTickets
};