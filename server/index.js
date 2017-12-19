var express = require('express');
var bodyParser = require('body-parser');
var routes = require('./routes');
var faker = require('faker');
var dbSeed = require('../database/seed');
var db = require('../database/dbHelpers');
var aws = require('aws-sdk');
var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';

var app = express();
// UNCOMMENT FOR REACT
app.use(express.static(__dirname + '/../react-client/dist'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();

app.get('/', function (req, res) {
  res.end('hello');
});

app.get('/sendToClientServer', function(req, res) {
  var message = { payer:
  { userId: 16,
    firstName: 'Erna',
    lastName: 'Hirthe',
    balance: 2348.23 },
  payee:
  { userId: 17,
    firstName: 'Ferne',
    lastName: 'Lueilwitz',
    balance: 1034.69 },
  amount: 100,
  transactionType: 'payment',
  transactionId: { _id: '5a380b30f0609c9f1b0c2fd7', transactionId: 7 },
  timestamp: 1513626786103 }; 
  var params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: fromClientServer,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.send(data);
    }
  });
});

app.get('/sendToBankServices', function(req, res) {
  var params = {
    MessageBody: JSON.stringify({userId: 1, transactionID: 555}),
    QueueUrl: toBankServices,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.send(data);
    }
  });
});

app.get('/sendToLedger', function(req, res) {
  var params = {
    MessageBody: JSON.stringify({transactionID: 4901973}),
    QueueUrl: toLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.send(data);
    }
  });
});

app.get('/fetchFromClientServer',
  routes.handleFromClientServer,
  db.initialSaveAndRoute,
  routes.sendToBankServices,
  routes.sendToLedger,
  function (req, res) {
    res.end();
  });

app.get('/fetchFromBankServices',
  routes.handleFromBankServices,
  db.fetchRequestInfo,
  routes.sendToLedger,
  db.updateStatus,
  routes.sendtoClientServer,
  function (req, res) {
    res.end();
  });

app.get('/fetchFromLedger',
  routes.handleFromLedger,
  // db.retreiveUpdatedBalances,
  routes.sendToClientServer,
  function (req, res) {
    res.end();
  });

app.listen(3000, function() {
  console.log('listening on port 3000!');
});

