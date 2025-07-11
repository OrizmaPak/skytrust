const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware
const pg = require("../../../db/pg");
const { addOneDay } = require("../../../utils/expiredate");
const { divideAndRoundUp } = require("../../../utils/pageCalculator");

const getbranch = async (req, res) => {

    let queryString = `SELECT * FROM skyeu."Branch" WHERE 1=1`;
    
    try {
        // return new Response(JSON.stringify({queryString, params, sort}))
        const { rows: branches } = await pg.query(queryString); // Pass params array
        
        if(branches.length > 0) {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "branches fetched successfully",
                statuscode: StatusCodes.OK,
                data: branches,
                errors: []
            });
        }
        if(branches.length == 0) {
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No Branch found",
                statuscode: StatusCodes.OK,
                data: '',
                errors: []  
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "An unexpected error occurred",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
}

module.exports = {
    getbranch
};