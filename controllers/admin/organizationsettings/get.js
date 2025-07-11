const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const getorgsettings = async (req, res) => {

    let userid;

    let queryString = `SELECT * FROM skyeu."Organisationsettings"`;
    

    try {
        // return new Response(JSON.stringify({queryString, params, sort}))
        const { rows: settings } = await pg.query(queryString); // Pass params array
        if(settings.length > 0) return res.status(StatusCodes.OK).json({
            status: true,
            message: "Origanization settings fetched successfully",
            statuscode: StatusCodes.OK,
            data: settings,
            errors: []
        });
        if(settings.length == 0) return res.status(StatusCodes.OK).json({
            status: true,
            message: "No Settings found",
            statuscode: StatusCodes.OK,
            data: '',
            errors: []  
        });
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
    getorgsettings
};