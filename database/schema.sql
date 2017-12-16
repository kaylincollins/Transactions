DROP DATABASE IF EXISTS transactionsDB;

CREATE DATABASE transactionsDB;

USE transactionsDB;

CREATE TABLE transactions (
  id int NOT NULL AUTO_INCREMENT,
  transactionID int NOT NULL,
  userID int,
  first_name varchar(50),
  last_name varchar(50),
  transaction_type varchar(10),
  transaction_kind varchar(10),
  status varchar(10),
  original_balance DECIMAL(12, 2),
  amount DECIMAL(10, 2),
  after_trans_bal DECIMAL(12, 2),
  trans_confirm varchar(50),
  int_ext varchar(10),
  orig_timestamp DATETIME,
  time_complete DATETIME,
  PRIMARY KEY (id)
);


/*  Execute this file from the command line by typing:
 *    mysql -u root < schema.sql
 *  to create the database and the tables.*/
