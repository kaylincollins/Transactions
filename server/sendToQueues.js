/*----------------SEND TO QUEUE FUNCTIONS---------------------*/

const aws = require('aws-sdk');
const faker = require('faker');

const fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
const toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
const fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
const toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
const fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
const toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';


aws.config.loadFromPath(__dirname + '/../config.json');
const sqs = new aws.SQS();

var sendToClientServer = () => {
// app.get('/sendToClientServer', function(req, res) {
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
      console.log(err);
    } else {
      console.log(data);
    }
  });
};

// app.get('/sendToBankServices', function(req, res) {

var sendToBankServices = () => {
  // var transactionID = faker.random.number(10000000);
  var transactionID = 281433;
  var status = faker.random.arrayElement(['approved', 'declined', 'cancelled', 'confirmed']);

  var message = {transactionID: 281433, status: status};

  var params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: fromBankServices,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
};

// app.get('/sendToLedger', function(req, res) {
var sendToLedger = () => {
  var params = {
    MessageBody: JSON.stringify([{transactionID: 4901973, userID: 7576248, balance: 130.42}, {transactionID: 4901973, userID: 7729431, balance: 2065.84}]),
    QueueUrl: fromLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log(data);
    }
  });
};


// sendToClientServer();
// sendToBankServices();
sendToLedger();

