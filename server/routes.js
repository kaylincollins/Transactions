var aws = require('aws-sdk');

var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';


aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();


module.exports.handleFromClientServer = function(req, res, next) {
  //
  var params = {
    QueueUrl: fromClientServer,
    VisibilityTimeout: 600 // 10 min wait time for anyone else to process.
  };
  
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.trans = JSON.parse(data.Messages[0].Body);
      console.log(res.trans);
      next();
      //res.send(data);
    } 
  });
  //check if transactionID is in the cache
    // if so, delete message

  //else 
    // Decide if internal or external transaction
    // If internal
      // send to ledger
    // if external
      // send to bank services

    // put transactionID in cache
    // record to DB the transaction ID and all info 
      // only update status when hear from bank services

    //delete message from queue


};

module.exports.handleFromBankServices = function(req, res, next) {
  //initial approval
    //send to ledger
  //initial decline
    // update status
    // send to client

  //eventual approval
    //update confirmation number in db
  //eventual decline
    // update status in db
    // send ledger reversal transaction
  var params = {
    QueueUrl: toBankServices,
    VisibilityTimeout: 300 // 10 min wait time for anyone else to process.
  };
  
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.bankResponse = JSON.parse(data.Messages[0].Body);
      if (res.bankResponse.status) {
        if (res.bankResponse.status === 'approved') {
          res.initialApproval = true;
          next();
        } else if (res.bankResponse.status === 'declined') {
          res.initialApproval = false;
          next();
        }
      } else if (res.bankResponse.confirmation) {
        res.confirmation = true;
        next();
      } 
    } 
  });
};

module.exports.handleFromLedger = function(req, res, next) {
  var params = {
    QueueUrl: toLedger,
    VisibilityTimeout: 300 // 10 min wait time for anyone else to process.
  };
  
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      // var transID = JSON.parse(data.Messages[0].Body).transactionID;
      res.ledgerResponse = JSON.parse(data.Messages[0].Body);
      for (var i = 0; i < res.ledgerResponse.length; i++) {
        res.ledgerResponse[i].status = 'approved';
      }
      
      next();
      // res.send(data);
    } 
  });
  // match transaction ID


  // update in DB with status 
  // send Client Server updated balances from the transaction

  // delete message from queue
};


module.exports.sendToClientServer = function(req, res, next) {
  var params = {
    MessageBody: JSON.stringify(res.ledgerResponse),
    QueueUrl: toClientServer,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.send(data);
    }
  });
};

module.exports.sendToBankServices = function(req, res, next) {
  if (res.next === 'ledger') {
    next();
  } else {
    var params = {
      MessageBody: JSON.stringify(res.bank),
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
  }
};

module.exports.sendToLedger = function(req, res, next) {
  var params = {
    MessageBody: JSON.stringify(res.ledger),
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
};