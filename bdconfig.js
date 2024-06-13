/*
const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'mysql',
  user: 'root',
  password: 'root',
  database: 'prueba'
});
module.exports = connection;

*/

const mysql = require('mysql');
const connection = mysql.createConnection({
  host: 'mysql',
  user: 'root', 
  password: 'root', 
  database: 'prueba'
});
module.exports = connection;
