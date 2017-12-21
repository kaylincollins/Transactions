var aws = require('aws-sdk');

var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';


aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();


module.exports.handleFromClientServer = (req, res, next) => {
  //
  var params = {
    QueueUrl: fromClientServer,
    VisibilityTimeout: 600, // 10 min wait time for anyone else to process.
    // MessageBody: {
    //   time: new Date(),
    // }
  };
  
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      // res.messageReceipt = JSON.stringify({MessageId: data.Messages[0].MessageId, ReceiptHandle: data.Messages[0].ReceiptHandle});

      res.messageReceipt = `"${data.Messages[0].ReceiptHandle}"`;
      console.log('MESSAGE', res.messageReceipt);
      res.trans = JSON.parse(data.Messages[0].Body);
      console.log('DATA FROM CLIENT SERVER', res.trans);
      next();
      //res.send(data);
    } 
  });
};

module.exports.handleFromBankServices = (req, res, next) => {
  var params = {
    QueueUrl: fromBankServices,
    VisibilityTimeout: 300 // 10 min wait time for anyone else to process.
  };
  
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.bankResponse = JSON.parse(data.Messages[0].Body);
      next();
    } 
  });
};

module.exports.handleFromLedger = (req, res, next) => {
  var params = {
    QueueUrl: fromLedger,
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

    } 
  });
};


module.exports.sendToClientServer = (req, res, next) => {

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

module.exports.sendDeclineToClientServer = (req, res, next) => {
  if (res.bankResponse.status !== 'declined') {
    next();
  }

  var params = {
    MessageBody: JSON.stringify(res.declineToClient),
    QueueUrl: toClientServer,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      res.end(JSON.stringify(data));
    }
  });
};

module.exports.sendToBankServices = (req, res, next) => {
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
        del.deleteClientQueue(fromClientServer, res.messageReceipt);
        res.end(JSON.stringify(data));
      }
    });
  }
};

module.exports.sendToLedger = (req, res, next) => {
  if (res.bankResponse !== 'approved' || res.next !== 'ledger') {
    next(); //move on to handle declined, confirmed or cancelled
  }

  var params = {
    MessageBody: JSON.stringify(res.ledger),
    QueueUrl: toLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      res.send(err);
    } else {
      del.deleteClientQueue(fromClientServer, res.messageReceipt);
      res.end(JSON.stringify(data));
    }
  });
};

module.exports.sendReversalToLedger = (req, res, next) => {
  //send reversal to ledger

  res.ledger.status = 'reversal';

  if (res.bankResponse === 'cancelled') {
    var params = {
      MessageBody: JSON.stringify(res.ledger),
      QueueUrl: toLedger,
      DelaySeconds: 0,
    };
    sqs.sendMessage(params, function(err, data) {
      if (err) {
        res.send(err);
      } else {
        res.end(JSON.stringify(data));
      }
    });
  }

};




