const apm = require('elastic-apm-node').start({
  // Set required app name (allowed characters: a-z, A-Z, 0-9, -, _, and space)
  appName: 'hrsf84-thesis',

  // // Use if APM Server requires a token
  // secretToken: '',

  // // Set custom APM Server URL (default: http://localhost:8200)
  // serverUrl: '',
});

// const express = require('express');
const bodyParser = require('body-parser');
const helper = require('./helpers');
const faker = require('faker');
const redis = require('redis');
const dbSeed = require('../database/seed');
const Consumer = require('sqs-consumer');
const aws = require('aws-sdk');
const fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
const toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
const fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
const toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
const fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
const toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';

let client = redis.createClient();

client.on('connect', function() {
  console.log('Connected to Redis...');
});


// const app = express();

// // app.use(express.static(__dirname + '/../react-client/dist'));
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());

aws.config.loadFromPath(__dirname + '/../config.json');
const sqs = new aws.SQS();

// app.get('/', function (req, res) {
//   res.end('hello');
// });

/*----------------CLIENT CONSUMER FUNCTION---------------------*/

const clientWorker = Consumer.create({
  queueUrl: fromClientServer,
  batchSize: 10,
  handleMessage: (message, done) => {
    var name = 'Handle from client services';
    var type = 'job';
    var trans = apm.startTransaction(name, type);

    var message = JSON.parse(message.Body);

    var isInternal = (message) => {
      if (message.payer.balance - message.amount >= 0) {
        return true;
      } else {
        return false;
      }
    };

    console.log("MESSAGEE", message);

    if ( message.transactionType === 'payment' && isInternal(message) ) {
      helper.saveToDB(message, helper.sendToLedger);
    } else {
      helper.saveToDB(message, helper.sendToBank);
    }
    done();
    trans.end();
 
  },
  sqs: new aws.SQS()
});
 
clientWorker.on('error', (err) => {
  console.log(err.message);
});
 
clientWorker.start();

/*----------------BANK CONSUMER FUNCTION---------------------*/

const bankWorker = Consumer.create({
  queueUrl: fromBankServices,
  batchSize: 10,
  handleMessage: (message, done) => {
    
    var name = 'Handle from bank services';
    var type = 'job';
    var trans = apm.startTransaction(name, type);


    var message = JSON.parse(message.Body);
    console.log('MESSAGE FROM BANK', message);

    if (message.status === 'approved') {
      console.log('approved'); 
      helper.fetchRequestInfo(message, helper.sendApprovedToLedger);
    }

    if (message.status === 'declined') {
      console.log('declined');
      helper.fetchRequestInfo(message, helper.sendDeclineToClientServer);
    }

    if (message.status === 'confirmed') {
      console.log('confirmed');
      helper.updateStatus(null, message.transactionID, message.status);
    }

    if (message.status === 'cancelled') {
      console.log('cancelled');
      helper.fetchRequestInfo(message, helper.sendReversalToLedger);
    }

    trans.end();
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
    var name = 'Handle from Ledger';
    var type = 'job';
    var trans = apm.startTransaction(name, type);

    var message = JSON.parse(message.Body);

    helper.addStatusFromLedger(message, helper.sendApprovedToClientServer);
    trans.end();
    done();
  },
  sqs: new aws.SQS()
});
 
ledgerWorker.on('error', (err) => {
  console.log(err.message);
});
 
ledgerWorker.start();



// app.use(apm.middleware.express());

// app.listen(3000, function() {
//   console.log('listening on port 3000!');
// });

