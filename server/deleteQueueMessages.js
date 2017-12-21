var aws = require('aws-sdk');

var del = require('./deleteQueueMessages');

aws.config.loadFromPath(__dirname + '/../config.json');
var sqs = new aws.SQS();

module.exports.deleteClientQueue = (queue, receipt) => {
  console.log('RECEIPT', receipt);
  var params = {
    QueueUrl: queue,
    ReceiptHandle: receipt
  };
  
  sqs.deleteMessage(params, function(err, data) {
    if (err) {
      console.log('ERROR WITH DELETING', err);
      // res.send(err);
    } else {
      console.log('delete data', data);
      // res.send(data);
    } 
  });
};