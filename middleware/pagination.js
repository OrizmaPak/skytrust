import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import pg from '../db/pg';

export const paginationMiddleware = async (request, userid, message, module) => {

  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CHECK IF THE SESSION IS IN THE SERVER
    await pg.query(`INSERT INTO budgetify."Activity" (userid, activity, date, module) VALUES ($1, $2, $3, $4)`, [userid, message, new Date(), module]);

  } catch (err) {
    console.error('Unexpected Error:', err);
    return new Response(JSON.stringify({
      status: false,
      message: 'An unexpected error occurred from activity log',
      statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
      data: null,
      errors: [{ field: '', message: err.message }]
    }), {
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
