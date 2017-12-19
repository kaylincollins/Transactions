const con = require('./index');


module.exports.retreiveUpdatedBalances = (req, res, next) => {
  con.connection.query(`SELECT transactionID, userID, after_trans_bal FROM transactions WHERE transactionID = ${res.transID}`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR!!!!', err);
        res.end('error with retreiving balances');
      } else {
        res.updatedBalances = results;
        next();
        // res.end(JSON.stringify(results)); 
      }
    });
};


module.exports.initialSaveAndRoute = (req, res, next) => {

  //check if transactionID is in the cache
    // if so, delete message

//else 
  var trans = res.trans;
  // Decide if internal or external transaction
  var payer = {
    transactionID: trans.transactionId.transactionId,
    userID: trans.payer.userId,
    first_name: trans.payer.firstName,
    last_name: trans.payer.lastName,
    transaction_type: '',
    transaction_kind: trans.transactionType,
    status: '',
    original_balance: trans.payer.balance,
    amount: trans.amount,
    after_trans_bal: '', 
    trans_confirm: null,
    int_ext: '',
  };

  if (trans.transactionType === 'payment') {

    var payee = {
      transactionID: trans.transactionId.transactionId,
      userID: trans.payee.userId,
      first_name: trans.payee.firstName,
      last_name: trans.payee.lastName,
      transaction_type: '',
      transaction_kind: trans.transactionType,
      status: '',
      original_balance: trans.payee.balance,
      amount: trans.amount,
      after_trans_bal: '', 
      trans_confirm: null,
      int_ext: ''
    };

    payer.transaction_type = 'debit';
    payee.transaction_type = 'credit';

    if (trans.payer.balance - trans.amount >= 0) {
      //status internal
      console.log('inside internal');

      payer.status = 'posted';
      payee.status = 'posted';

      payer.after_trans_bal = payer.original_balance - payer.amount;
      payee.after_trans_bal = payee.original_balance + payee.amount;


      payer.int_ext = 'internal';
      payee.int_ext = 'internal';

      savePayment(payer, payee);
      
      res.next = 'ledger';
      
      res.ledger = {
        Payer: { 
          userID: payer.userID,
          firstName: payer.first_name,
          lastName: payer.last_name
        },
        Payee: { 
          userID: payee.userID,
          firstName: payee.first_name,
          lastName: payee.last_name
        },
        amount: payer.amount,
        transactionID: payer.transactionID,
        transactionKind: payer.int_ext,
        action: payer.transaction_kind,
        status: null,
        timestamp: trans.timestamp
      };

      next();

    } else {
      //status external
      payer.after_trans_bal = payer.original_balance;
      payee.after_trans_bal = payee.original_balance + payee.amount;

      payer.int_ext = 'external';
      payee.int_ext = 'external';

      payer.status = 'pending';
      payee.status = 'pending';

      savePayment(payer, payee);
      
      res.next = 'bank';
      res.bank = {
        userID: payer.userID,
        amount: payer.amount,
        transactionType: payer.transaction_kind,
        transactionID: payer.transactionID
      };
      next();
    }
  } else if (trans.transactionType === 'cashout') {
    //save all transaction info
    payer.after_trans_bal = payer.original_balance - payer.amount;
    payer.int_ext = 'external';
    payer.status = 'pending';
    payee.transaction_type = 'credit';

    saveCashout();

    res.next = 'bank';

    res.bank = {
      userID: payer.userID,
      amount: payer.amount,
      transactionType: payer.transaction_kind,
      transactionID: payer.transactionID
    };

    next();
  }
};

var savePayment = function(payer, payee) {
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext) VALUES (${payer.transactionID}, ${payer.userID}, '${payer.first_name}', '${payer.last_name}', '${payer.transaction_type}', '${payer.transaction_kind}', '${payer.status}', ${payer.original_balance}, ${payer.amount}, ${payer.after_trans_bal}, ${payer.trans_confirm}, '${payer.int_ext}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR!!!!', err);
        res.end('error with saving payment');
      } 
    });
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext) VALUES (${payee.transactionID}, ${payee.userID}, '${payee.first_name}', '${payee.last_name}', '${payee.transaction_type}', '${payee.transaction_kind}', '${payee.status}', ${payee.original_balance}, ${payee.amount}, ${payee.after_trans_bal}, ${payee.trans_confirm}, '${payee.int_ext}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR!!!!', err);
        res.end('error with saving payment');
      } 
    });
};

var saveCashout = function(payer) {
  con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext) VALUES (${payer.transactionID}, ${payer.userID}, '${payer.first_name}', '${payer.last_name}', '${payer.transaction_type}', '${payer.transaction_kind}', '${payer.status}', ${payer.original_balance}, ${payer.amount}, ${payer.after_trans_bal}, ${payer.trans_confirm}, '${payer.int_ext}')`, 
    function (err, results, fields) {
      if (err) {
        console.log('ERROR!!!!', err);
        res.end('error with saving cashout');
      } 
    });
};


