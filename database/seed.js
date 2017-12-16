const con = require('./index');
const faker = require('faker');
const jsonfile = require('jsonfile');

const outfile = './database/outfile.txt';

const generateData = () => {

  var random = Math.ceil(Math.random() * 100);

  var transactionID = faker.random.number(10000000);
  var kind = random > 70 ? 'cashout' : 'payment';
  var type1 = kind === 'payment' ? 'debit' : 'credit';
  var type2 = 'credit';
  var originalTime, status, balanceAfterTransaction, intOrExt, originalBalance2;

  if ( random > 95 ) { //95% of the time, make the payment within last 2-3 days and set to pending
    originalTime = JSON.stringify(faker.date.between('2017-12-12', '2017-12-15'));
    status = 'pending';
  } else {
    originalTime = JSON.stringify(faker.date.between('2017-10-01', '2017-12-12'));
    status = faker.random.arrayElement(['posted', 'posted', 'posted', 'posted', 'posted', 'declined', 'cancelled']);
  }

  var timeComplete = originalTime; //find a way to add a few seconds

  originalTime = originalTime.slice(1, 11) + ' ' + originalTime.slice(12, 20);
  timeComplete = timeComplete.slice(1, 11) + ' ' + timeComplete.slice(12, 20);

  var confirmation = status === 'pending' ? null : faker.helpers.replaceSymbolWithNumber('#########');

  var originalBalance = random > 80 ? faker.finance.amount(0, 2999.99, 2) : faker.finance.amount(0, 500, 2);

  var amount = random > 80 ? Number(faker.finance.amount(0, 2999.99, 2)) : Number(faker.finance.amount(0, 500, 2));

  if ( originalBalance - amount >= 0 ) {
    balanceAfterTransaction = originalBalance - amount;
    intOrExt = 'internal';
  } else {
    balanceAfterTransaction = originalBalance;
    intOrExt = 'external';
  }

  var firstRequest = {
    transactionID: transactionID,
    userID: faker.random.number(10000000),
    first_name: faker.name.firstName(),
    last_name: faker.name.lastName(),
    transaction_type: type1,
    transaction_kind: kind,
    status: status,
    original_balance: Number(originalBalance),
    amount: amount,
    after_trans_bal: Number(balanceAfterTransaction), 
    trans_confirm: confirmation,
    int_ext: intOrExt,
    orig_timestamp: originalTime,
    time_complete: timeComplete,
  };

  
  if (kind === 'payment') {
    console.log('insdie payment');
    console.log(firstRequest.transactionID, firstRequest.transactionID);
    //create the credit side of the payment
  
    originalBalance2 = random > 80 ? faker.finance.amount(0, 2999.99, 2) : faker.finance.amount(0, 500, 2);

    var balanceAfterTransaction2 = Number(originalBalance2) + Number(firstRequest.amount);

    var secondRequest = {
      transactionID: firstRequest.transactionID,
      userID: faker.random.number(10000000),
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName(),
      transaction_type: type2,
      transaction_kind: kind,
      status: firstRequest.status,
      original_balance: Number(originalBalance2),
      amount: firstRequest.amount,
      after_trans_bal: Number(balanceAfterTransaction2), 
      trans_confirm: confirmation,
      int_ext: intOrExt,
      orig_timestamp: originalTime,
      time_complete: timeComplete,
    };
  
  } else if (kind === 'cashout') {
    //create another cashout
    console.log('inside cashout');
    intOrExt = 'external';
    originalBalance2 = random > 80 ? Number(faker.finance.amount(0, 2999.99, 2)) : Number(faker.finance.amount(0, 500, 2));

    amount = Number(faker.finance.amount(0, originalBalance2));

    var balanceAfterTransaction2 = Number(originalBalance2) - Number(amount);

    var secondRequest = {
      transactionID: faker.random.number(10000000),
      userID: faker.random.number(10000000),
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName(),
      transaction_type: type2,
      transaction_kind: kind,
      status: firstRequest.status,
      original_balance: Number(originalBalance2),
      amount: amount,
      after_trans_bal: Number(balanceAfterTransaction2), 
      trans_confirm: confirmation,
      int_ext: intOrExt,
      orig_timestamp: originalTime,
      time_complete: timeComplete,
    };
  }

  var first = [];
  for (var key in firstRequest) {
    first.push(firstRequest[key]);
  }

  var second = [];
  for (var key in secondRequest) {
    second.push(secondRequest[key]);
  }

  return [first.join(','), second.join(',')];



  // con.connection.query(`INSERT INTO transactions (transactionID, userID, first_name, last_name, transaction_type, transaction_kind, status, original_balance, amount, after_trans_bal, trans_confirm, int_ext, orig_timestamp, time_complete) VALUES (${data.transactionID}, ${data.userID}, '${data.first_name}', '${data.last_name}', '${data.transaction_type}', '${data.transaction_kind}', '${data.status}', ${data.original_balance}, ${data.amount}, ${data.after_trans_bal}, ${data.trans_confirm}, '${data.int_ext}', '${data.orig_timestamp}', '${data.time_complete}')`, 
  //   function (err, results, fields) {
  //     if (err) {
  //       console.log('ERROR!!!!', err);
  //       //next();
  //     } else {
  //       console.log('finished!!');
  //       res.end(JSON.stringify(data)); 
  //     }
  //   });

};

const generateNTransactions = (n) => {
  for (var i = 0; i < n; i += 2) {
    var transactions = generateData();
    var transaction1 = i + ',' + transactions[0];
    console.log('transaction', transaction1);
    var transaction2 = (i + 1) + ',' + transactions[1];

    jsonfile.writeFileSync(outfile, transaction1, {flag: 'a', spaces: 0, EOL: '\r\n'}, function(err) {
      if (err) {
        return console.log('ERROR', err);
      }

      console.log('The file was saved with transactionID', transaction1.transactionID);
    });

    jsonfile.writeFileSync(outfile, transaction2, {flag: 'a', spaces: 0, EOL: '\r\n'}, function(err) {
      if (err) {
        return console.log('ERROR', err);
      }

      console.log('The file was saved with transactionID', transaction2.transactionID);
    });
  }
};

generateNTransactions(5);




















