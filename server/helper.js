const con = require('../database/index');

var aws = require('aws-sdk');
const redis = require('redis');

var fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
var toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
var fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
var toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
var fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
var toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';

let client = redis.createClient();
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

    cacheRequest(payer.transactionID, payer);
    cacheRequest(payee.transactionID, payee);
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

    cacheRequest(payer.transactionID, payer);
    cacheRequest(payee.transactionID, payee);
    savePayment(payer, payee, callback);

  } else {
    //cashout
    payee.transaction_kind = 'credit';

    payee.status = 'pending';

    payee.after_trans_bal = message.payer.balance + message.amount;

    payee.int_ext = 'external';


    payee.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);

    cacheRequest(payee.transactionID, payee);
    saveCashout(payee, callback);

  }

};

var cacheRequest = (transactionID, message) => {
  console.log('inside cache');
  client.hmset(transactionID, [
    'userID', message.userID,
    'first_name', message.first_name,
    'last_name', message.last_name,
    'transaction_type', message.transaction_type,
    'transaction_kind', message.transaction_kind,
    'status', message.status,
    'original_balance', message.original_balance,
    'amount', message.amount,
    'after_trans_bal', message.after_trans_bal,
    'trans_confirm', message. trans_confirm,
    'int_ext', message.int_ext,
    'orig_timestamp', message.orig_timestamp,
    'time_complete', message.time_complete,
  ], function(err, reply) {
    if (err) {
      console.log(err);
    } 
    console.log('REPLY', reply);
    
  });
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
    status: null,
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

module.exports.sendApprovedToLedger = (results) => {

  for (var i = 0; i < results.length; i++) {
    if (results[i].transaction_type === 'debit') {
      var payer = {
        userID: results[i].userID,
        firstName: results[i].first_name,
        lastName: results[i].last_name
      };
    } else if (results[i].transaction_type === 'credit') {
      var payee = {
        userID: results[i].userID,
        firstName: results[i].first_name,
        lastName: results[i].last_name
      };
    }
  }
  var ledgerApproved = {
    payer: payer || {userID: null, firstName: null, lastName: null},
    payee: payee,
    amount: results[0].amount,
    transactionID: results[0].transactionID,
    transactionKind: results[0].int_ext,
    action: results[0].transaction_kind,
    status: null,
    timestamp: results[0].orig_timestamp
  };   

  var params = {
    MessageBody: JSON.stringify(ledgerApproved),
    QueueUrl: toLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log('Sent pre-approved request to ledger queue!');
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

/*----------------UPDATING DB FUNCTIONS---------------------*/

module.exports.updateStatus = (message) => {
  con.connection.query(`UPDATE transactions SET status = '${message.status}' WHERE transactionID = ${message.transactionID}`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with updating status', err);
      }
    });
};


/*----------------FETCH FROM DB FUNCTIONS---------------------*/
var updateStatusWithID = (id, status) => {
  con.connection.query(`UPDATE transactions SET status = '${status}' WHERE id = ${id}`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with updating status using ID', err);
      }
    });
};


module.exports.fetchRequestInfo = (message, callback) => {
  //handle case of initial approval from bank
  //need to fetch transaction info and send to ledger
  //will need to cache this later for speed
  console.log('inside fetch request info');
  
  con.connection.query(`SELECT * FROM transactions WHERE transactionID = ${message.transactionID}`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with fetching transaction info', err);
      } else {
        callback(results, updateStatusWithID);
      }
    });
};


module.exports.sendDeclineToClientServer = (message, callback) => {

  var declineMessage = [];

  message.forEach(function(row) {
    declineMessage.push({transactionID: row.transactionID, status: 'declined', userID: row.userID, balance: row.original_balance});
    callback(row.id, 'declined'); //updateStatusWithID
  });

  var params = {
    MessageBody: JSON.stringify(declineMessage),
    QueueUrl: toClientServer,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log('ERROR with sending decline from bank', err);
    } 
  });
};

module.exports.sendReversalToLedger = (results, callback) => {
  for (var i = 0; i < results.length; i++) {
    if (results[i].transaction_type === 'debit') {
      var payer = {
        userID: results[i].userID,
        firstName: results[i].first_name,
        lastName: results[i].last_name
      };
    } else if (results[i].transaction_type === 'credit') {
      var payee = {
        userID: results[i].userID,
        firstName: results[i].first_name,
        lastName: results[i].last_name
      };
    }
  }
  var ledgerReversal = {
    payer: payer || {userID: null, firstName: null, lastName: null},
    payee: payee,
    amount: results[0].amount,
    transactionID: results[0].transactionID,
    transactionKind: results[0].int_ext,
    action: results[0].transaction_kind,
    status: 'reversal',
    timestamp: results[0].orig_timestamp
  };   

  var params = {
    MessageBody: JSON.stringify(ledgerReversal),
    QueueUrl: toLedger,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log('Sent reversal request to ledger queue!');
      results.forEach(function(row) {
        callback(row.id, 'cancelled');
      });
    }
  }); 
};

module.exports.addStatusFromLedger = (message, callback) => {
  message.forEach(function(row) {
    row.status = 'approved';
  });
  callback(message);
};


module.exports.sendApprovedToClientServer = (message) => {
// console.log('MESSAGE INSDIE SENT TO CS', message);
  var params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: toClientServer,
    DelaySeconds: 0,
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log('ERROR with sending approved to client server', err);
    } 
  });
};


