// db.js
const { Client } = require('pg');

// console.log('DATABASE_URL:', process.env.DATABASE_URL);
// Create a new client instance
const pg = new Client({
  connectionString: process.env.DATABASE_URL
});
// Connect to the database
pg.connect()
  .then(() => console.log('Connected to the database pg'))
  // .catch(err => console.erro.r('Connection error'));
  .catch(err => console.error('Connection error', err.stack));

module.exports = pg; 
 