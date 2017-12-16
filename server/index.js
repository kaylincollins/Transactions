var express = require('express');
var bodyParser = require('body-parser');
var routes = require('./routes');
var faker = require('faker');
var db = require('../database/seed');

var app = express();

// UNCOMMENT FOR REACT
app.use(express.static(__dirname + '/../react-client/dist'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', db.generateData, function (req, res) {
  res.end(faker.name.findName());
});

app.post('/request', routes.route, function (req, res) {
  //incoming request from Client Services 
  // decide which route to take based on 
  res.end(JSON.stringify(res.photos));
});

app.post('/confirmation', function(req, res) {
  //incoming data from Bank Services as a confirmation
  //need to update DB
  //only go to Ledger if it was cancelled
  res.end(JSON.stringify());
});

app.listen(3000, function() {
  console.log('listening on port 3000!');
});

