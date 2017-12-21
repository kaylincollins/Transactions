const con = require('../database/index');

var aws = require('aws-sdk');

var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';


aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();

module.exports.saveToDB = (message, callback) => {
  
  var isInternal = (message) => {
    if (message.payer.balance - message.amount >= 0) {
      return true;
    } else {
      return false;
    }
  };

  var originalTime = JSON.stringify(message.timestamp);
  
  payer = {
    transactionID: message.transactionId.transactionId,
    userID: message.payer.userId,
    first_name: message.payer.firstName,
    last_name: message.payer.lastName,
    transaction_type: message.transactionType,
    amount: message.amount,
    original_balance: message.payer.balance,
    trans_confirm: null
  };

  payee = {
    transactionID: message.transactionId.transactionId,
    userID: message.payee.userId,
    first_name: message.payee.firstName,
    last_name: message.payee.lastName,
    transaction_type: message.transactionType,
    amount: message.amount,
    original_balance: message.payee.balance,
    trans_confirm: null
  };

  if ( message.transactionType === 'payment' && isInternal(message) ) {

    //payment and internal
    payer.transaction_kind = 'debit';
    payee.transaction_kind = 'credit';

    payer.status = 'posted';
    payee.status = 'posted';

    payer.after_trans_bal = message.payer.balance - message.amount;
    payee.after_trans_bal = message.payer.balance + message.amount;

    payer.int_ext = 'internal';
    payee.int_ext = 'internal';


    payer.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);
    payee.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);

    savePayment(payer, payee, callback);


  } else if ( message.transactionType === 'payment' && !isInternal(message) ) {
    //payment and external
    
    payer.transaction_kind = 'debit';
    payee.transaction_kind = 'credit';

    payer.status = 'pending';
    payee.status = 'pending';

    payer.after_trans_bal = message.payer.balance - message.amount;
    payee.after_trans_bal = message.payer.balance + message.amount;

    payer.int_ext = 'external';
    payee.int_ext = 'external';


    payer.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);
    payee.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);

    savePayment(payer, payee, callback);

  } else {
    //cashout
    payee.transaction_kind = 'credit';

    payee.status = 'pending';

    payee.after_trans_bal = message.payer.balance + message.amount;

    payee.int_ext = 'external';


    payee.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);

    saveCashout(payee, callback);

  }

};


module.exports.sendToBank = (payer, payee) => {

  var bankMessage = {
    userID: payer.userID,
    amount: payer.amount,
    transactionType: payer.transaction_kind,
    transactionID: payer.transactionID
  };

  var params = {
    MessageBody: JSON.stringify(bankMessage),
    QueueUrl: toBankServices,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log('Sent to bank queue!');
    }
  });
};

module.exports.sendToLedger = (payer, payee) => {

  var ledgerMessage = {
    payer: { 
      userID: payer.userID,
      firstName: payer.first_name,
      lastName: payer.last_name
    },
    payee: { 
      userID: payee.userID,
      firstName: payee.first_name,
      lastName: payee.last_name
    },
    amount: payer.amount,
    transactionID: payer.transactionID,
    transactionKind: payer.int_ext,
    action: payer.transaction_kind,
    status: payer.status,
    timestamp: payer.orig_timestamp
  };

  var params = {
    MessageBody: JSON.stringify(ledgerMessage),
    QueueUrl: toLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log('Sent to ledger queue!');
    }
  });
};



/*----------------SAVING TO DB FUNCTIONS---------------------*/

var savePayment = function(payer, payee, cb) {
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext, orig_timestamp) VALUES (${payer.transactionID}, ${payer.userID}, '${payer.first_name}', '${payer.last_name}', '${payer.transaction_type}', '${payer.transaction_kind}', '${payer.status}', ${payer.original_balance}, ${payer.amount}, ${payer.after_trans_bal}, ${payer.trans_confirm}, '${payer.int_ext}', '${payer.orig_timestamp}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with Payer Save', err);
      } 
    });
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext, orig_timestamp) VALUES (${payee.transactionID}, ${payee.userID}, '${payee.first_name}', '${payee.last_name}', '${payee.transaction_type}', '${payee.transaction_kind}', '${payee.status}', ${payee.original_balance}, ${payee.amount}, ${payee.after_trans_bal}, ${payee.trans_confirm}, '${payee.int_ext}', '${payee.orig_timestamp}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with Payee save', err);
      } else {
        console.log('SAVED!');
        cb(payer, payee);
      }
    });
};

var saveCashout = function(payee, cb) {
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext, orig_timestamp) VALUES (${payee.transactionID}, ${payee.userID}, '${payee.first_name}', '${payee.last_name}', '${payee.transaction_type}', '${payee.transaction_kind}', '${payee.status}', ${payee.original_balance}, ${payee.amount}, ${payee.after_trans_bal}, ${payee.trans_confirm}, '${payee.int_ext}', '${payee.orig_timestamp}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR!!!!', err);
      } else {
        console.log('SAVED!');
        cb(payee, null);
      }
    });
};








