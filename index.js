'use strict';

var meta = require('./lib/meta');
var ticketsClient = require('./lib/client/createTicket');
var updateTicketClient = require('./lib/client/updateTicket');
var getTicketClient = require('./lib/client/getTicket');
var accountClient = require('./lib/client/account');
var resultsClient = require('./lib/client/results');
var authClient = require('./lib/client/auth');

var sendLotteryTicket = function sendLotteryTicket(ticketRequest, options, callback) {
  return ticketsClient.sendLotteryTicket(ticketRequest, options, callback);
};

var authorizeUser = function authorizeUser(authRequest, options, callback) {
  return authClient.authorizeUser(authRequest, options, callback);
};

var getResults = function getResults(options, callback) {
  return resultsClient.getResults(options, callback);
};

var getTickets = function getTickets(jar, options, callback) {
  return accountClient.getTickets(jar, options, callback);
};

var updateLotteryTicket = function updateLotteryTicket(jar, id, updateTicketRequest, options, callback) {
  return updateTicketClient.updateLotteryTicket(jar, id, updateTicketRequest, options, callback);
};

var getLotteryTicket = function getLotteryTicket(jar, id, options, callback) {
  return getTicketClient.getLotteryTicket(jar, id, options, callback);
};

module.exports = {
  VERSION: meta.VERSION,
  authorizeUser: authorizeUser,
  sendLotteryTicket: sendLotteryTicket,
  getResults: getResults,
  getTickets: getTickets,
  updateLotteryTicket: updateLotteryTicket,
  getLotteryTicket: getLotteryTicket
};