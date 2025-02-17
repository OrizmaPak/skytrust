const { Client } = require('pg');
const pg = require("../db/pg");

// Transaction middleware
const withTransaction = async(req, res, next) => {
    try {
      await pg.query('BEGIN'); // Start a new transaction

      // Attach the client to the request object for access in the controller
      req.dbClient = pg;

      // Call the next middleware/controller
      await next();

      await pg.query('COMMIT'); // Commit the transaction if all goes well
    } catch (error) {
      await pg.query('ROLLBACK'); // Rollback if there is an error
      console.error('Transaction error:', error);
      res.status(500).send('Internal Server Error'); // Send an error response
    }
};

module.exports = withTransaction;
