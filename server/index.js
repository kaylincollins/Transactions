var apm = require('elastic-apm-node').start({
  // Set required app name (allowed characters: a-z, A-Z, 0-9, -, _, and space)
  appName: 'hrsf84-thesis',

  // // Use if APM Server requires a token
  // secretToken: '',

  // // Set custom APM Server URL (default: http://localhost:8200)
  // serverUrl: '',
});


var express = require('express');
var bodyParser = require('body-parser');
var routes = require('./routes');
var helper = require('./helper');
var faker = require('faker');
var dbSeed = require('../database/seed');
var db = require('../database/dbHelpers');
var Consumer = require('sqs-consumer');
var aws = require('aws-sdk');
var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';

var app = express();

// app.use(express.static(__dirname + '/../react-client/dist'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();

app.get('/', function (req, res) {
  res.end('hello');
});

/*----------------CLIENT CONSUMER FUNCTION---------------------*/

const clientWorker = Consumer.create({
  queueUrl: fromClientServer,
  batchSize: 10,
  handleMessage: (message, done) => {
    var message = JSON.parse(message.Body);
    
    var isInternal = (message) => {
      if (message.payer.balance - message.amount >= 0) {
        return true;
      } else {
        return false;
      }
    };

    if ( message.transactionType === 'payment' && isInternal(message) ) {
      helper.saveToDB(message, helper.sendToLedger);
    } else {
      helper.saveToDB(message, helper.sendToBank);
    }
    done();
 
  },
  sqs: new aws.SQS()
});
 
clientWorker.on('error', (err) => {
  console.log(err.message);
});
 
// clientWorker.start();

/*----------------BANK CONSUMER FUNCTION---------------------*/

const bankWorker = Consumer.create({
  queueUrl: fromBankServices,
  batchSize: 10,
  handleMessage: (message, done) => {
    var message = JSON.parse(message.Body);
    console.log('MESSAGE FROM BANK', message);

    if (message.status === 'approved') {
      console.log('approved');
      //fetch data 
      helper.fetchRequestInfo(message, helper.sendApprovedToLedger);
      //send to Ledger
    }

    if (message.status === 'declined') {
      console.log('declined');
      helper.fetchRequestInfo(message, helper.sendDeclineToClientServer);
    }

    if (message.status === 'confirmed') {
      console.log('confirmed');
      helper.updateStatus(message);
    }

    if (message.status === 'cancelled') {
      console.log('cancelled');
      //write a reversal transaction
      //update original transaction 
      //send reversal to ledger
    }





    done();
  },
  sqs: new aws.SQS()
});
 
bankWorker.on('error', (err) => {
  console.log(err.message);
});
 
bankWorker.start();

/*----------------LEDGER CONSUMER FUNCTION---------------------*/

const ledgerWorker = Consumer.create({
  queueUrl: fromLedger,
  batchSize: 10,
  handleMessage: (message, done) => {
    console.log('MESSAGE FROM WORKER', message);
    done();
  },
  sqs: new aws.SQS()
});
 
ledgerWorker.on('error', (err) => {
  console.log(err.message);
});
 
// ledgerWorker.start();

/*----------------SEND TO QUEUE FUNCTIONS---------------------*/


app.get('/sendToClientServer', function(req, res) {
  var transactionID = faker.random.number(10000000);

  var message = { payer:
  { userId: 16,
    firstName: 'Erna',
    lastName: 'Hirthe',
    balance: 101 },
  payee:
  { userId: 17,
    firstName: 'Ferne',
    lastName: 'Lueilwitz',
    balance: 1034.69 },
  amount: 100,
  transactionType: 'payment',
  transactionId: { _id: '5a380b30f0609c9f1b0c2fd7', transactionId: transactionID },
  timestamp: '2017-12-21T19:40:12.618Z' }; 

  var message1 = { payer:
  { userId: 16,
    firstName: 'Erna',
    lastName: 'Hirthe',
    balance: 2348.23 },
  payee:
  { userId: 16,
    firstName: 'Erna',
    lastName: 'Hirthe',
    balance: 2348.23 },
  amount: 100,
  transactionType: 'cashout',
  transactionId: { _id: '5a380b30f0609c9f1b0c2fd7', transactionId: transactionID },
  timestamp: '2017-12-21T19:40:12.618Z' }; 
  var params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: fromClientServer,
    DelaySeconds: 0,
  };


  var random = Math.ceil(Math.random() * 2);

  var send = random === 1 ? message : message1;

  var params = {
    MessageBody: JSON.stringify(send),
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

  var transactionID = faker.random.number(10000000);
  var status = faker.random.arrayElement(['approved', 'declined', 'cancelled', 'confirmed']);

  var message = {transactionID: 7, status: status};

  var params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: fromBankServices,
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
    MessageBody: JSON.stringify([{transactionID: 4901973, userID: 7576248, balance: 130.42}, {transactionID: 4901973, userID: 7729431, balance: 2065.84}]),
    QueueUrl: fromLedger,
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

/*----------------FETCH FROM QUEUE FUNCTIONS---------------------*/

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
  routes.sendDeclineToClientServer,
  routes.sendReversalToLedger,
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


app.use(apm.middleware.express());

app.listen(3000, function() {
  console.log('listening on port 3000!');
});

