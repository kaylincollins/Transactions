const con = require('../database/index');

const aws = require('aws-sdk');
const redis = require('redis');

const fromClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/clientserver';
const toClientServer = 'https://sqs.us-east-2.amazonaws.com/025476314761/toClientServer';
const fromBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromBankServices';
const toBankServices = 'https://sqs.us-east-2.amazonaws.com/025476314761/toBankServices';
const fromLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/fromLedger';
const toLedger = 'https://sqs.us-east-2.amazonaws.com/025476314761/toLedger';

let client = redis.createClient();
aws.config.loadFromPath(__dirname + '/../config.json');
const sqs = new aws.SQS();

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

    cacheRequest(payer.transactionID, payer, payee);
    // cacheRequest(payee.transactionID, payee);
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

    cacheRequest(payer.transactionID, payer, payee);
    // cacheRequest(payee.transactionID, paye);
    savePayment(payer, payee, callback);

  } else {
    //cashout
    payee.transaction_kind = 'credit';

    payee.status = 'pending';

    payee.after_trans_bal = message.payer.balance + message.amount;

    payee.int_ext = 'external';


    payee.orig_timestamp = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);

    cacheRequest(payee.transactionID, payer, payee);
    saveCashout(payee, callback);

  }

};

var cacheRequest = (transactionID, payer, payee) => {
  console.log('inside cache PAYER', payer);
  console.log('inside cache PAYEE', payee);
  client.hmset(transactionID, [
    'payer_userID', payer.userID,
    'payer_first_name', payer.first_name,
    'payer_last_name', payer.last_name,
    'payer_original_balance', payer.original_balance,
    'payer_after_trans_bal', payer.after_trans_bal,
    'payee_userID', payee.userID,
    'payee_first_name', payee.first_name,
    'payee_last_name', payee.last_name,
    'payee_transaction_type', payee.transaction_type, //cashout or payment
    'payee_transaction_kind', payee.transaction_kind,
    'payee_status', payee.status,
    'payee_original_balance', payee.original_balance,
    'payee_amount', payee.amount,
    'payee_after_trans_bal', payee.after_trans_bal,
    'payee_int_ext', payee.int_ext,
    'payee_orig_timestamp', payee.orig_timestamp,
  ], function(err, reply) {
    if (err) {
      console.log(err);
    } 
    console.log('REPLY', reply);
    console.log('TransactionID', transactionID);
    
  });
};


// PAYER { transactionID: 3074022,
//   userID: 16,
//   first_name: 'Erna',
//   last_name: 'Hirthe',
//   transaction_type: 'cashout',
//   amount: 100,
//   original_balance: 2348.23,
//   trans_confirm: null }


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

module.exports.sendDeclineToClientServer = (message, callback) => {

  var declineMessage = [];

  message.forEach(function(row) {
    declineMessage.push({transactionID: row.transactionID, status: 'declined', userID: row.userID, balance: row.original_balance});
    callback(row.id, row.transactionID, 'declined'); //updateStatus //WithID
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
        callback(row.id, row.transactionID, 'cancelled');
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
    console.log('sent approved to client server');
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

module.exports.updateStatus = (id, transactionID, status) => {
  console.log('inside update status');
  console.log(id, transactionID, status);
  con.connection.query(`UPDATE transactions SET status = '${status}' WHERE transactionID = '${transactionID}'`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR with updating status', err);
      }
    });
};


/*----------------FETCH FROM DB FUNCTIONS---------------------*/
var updateStatusWithID = (id, transactionID, status) => {
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
  client.hmget(message.transactionID, [
    'payer_userID', //0
    'payer_first_name', //1
    'payer_last_name', //2
    'payer_original_balance', //3
    'payer_after_trans_bal', //4
    'payee_userID', //5
    'payee_first_name', //6
    'payee_last_name', //7
    'payee_transaction_type', //cashout or payment 8
    'payee_transaction_kind', //9
    'payee_status', //10
    'payee_original_balance', //11
    'payee_amount', //12
    'payee_after_trans_bal', //13
    'payee_int_ext', //14
    'payee_orig_timestamp', //15
  ], function(err, reply) {
    if (err) {
      console.log(err);
    } else if (reply[0] !== null) {

      var payer = {
        transactionID: message.transactionID,
        userID: reply[0],
        first_name: reply[1],
        last_name: reply[2],
        transaction_type: 'debit',
        transaction_kind: reply[8],
        status: reply[10],
        original_balance: reply[3],
        amount: reply[12],
        after_trans_bal: reply[4],
        int_ext: reply[14],
        orig_timestamp: reply[15]
      };

      var payee = {
        transactionID: message.transactionID,
        userID: reply[5],
        first_name: reply[6],
        last_name: reply[7],
        transaction_type: reply[9],
        transaction_kind: reply[8],
        status: reply[10],
        original_balance: reply[11],
        amount: reply[12],
        after_trans_bal: reply[13],
        int_ext: reply[14],
        orig_timestamp: reply[15]
      };

      var results = [payer, payee];      
      console.log('REPLY', results); 
      callback(results, module.exports.updateStatus);

    } else {
      console.log('inside fetch request info');
      
      con.connection.query(`SELECT * FROM transactions WHERE transactionID = ${message.transactionID}`, 
        function (err, results, fields) {
          if (err) {
            console.log('ERROR with fetching transaction info', err);
          } else {
            console.log('RESULTS FROM DB', results);
            callback(results, updateStatusWithID);
          }
        });
    }
  });
};





