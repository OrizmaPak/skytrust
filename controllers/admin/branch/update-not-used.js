const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");

const updatebranch = async (req, res) => {
    const { id, branch, country, state, lga, address='' } = req.body;

    if(!id){
        // TRACK ACTIVITY
        // const activity = activityMiddleware(req, user.id, `Wanted to update an unknown Budget`, 'BUDGET')

        // INFORM THE USER 
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Id not provided",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: []
        });
    }

    // Basic validation
    if (!branch || !country || !state ) {
        let errors = [];
        if (!branch) {
            errors.push({
                field: 'Branch Name',
                message: 'Branch name not found' 
            }); 
        }
        if (!country) {
            errors.push({
                field: 'Country',
                message: 'Country not found'
            });
        }
        if (!state) {
            errors.push({
                field: 'State',
                message: 'State not found'
            });
        }
        if (!lga) {
            errors.push({
                field: 'lga',
                message: 'Local Government Area not found'
            });
        }

        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Missing Fields",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: errors
        });
    }


    try{
        // CHECK IF NAME ALREADY EXIST
        if(branch){
            const {rows:checkname} = await pg.query(`SELECT branch FROM skyeu."Budget" WHERE branch = $1`, [branch]);
            // IT MEANS THE USER DOES NOT WANT TO UPDATE
            if(checkname.length){
                // TRACK ACTIVITY
                // const activity = activityMiddleware(req, user.id, `Tried to create an already existing budget by the branch ${branch}`, 'BUDGET')

                // INFORM THE USER 
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Branch already exist",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }
        


            // THIS MEANS THE USER WANTS TO UPDATE
            const {rowCount: updatelocation} = await pg.query(`UPDATE skyeu."Budget" 
                             SET branch = COALESCE($1, branch), 
                                 country = COALESCE($2, country), 
                                 state = COALESCE($3, state), 
                                 lga = COALESCE($4, lga), 
                                 address = COALESCE($5, address) 
                         WHERE id = $7 AND status = 'ACTIVE'`, [branch, country, state, lga, address, id]);
            // TRACK ACTIVITY
            // const activity = activityMiddleware(req, user.id, `Updated `, 'BUDGET');

            // INFORM THE USER 
            if(updatelocation > 0){
                return res.status(StatusCodes.OK).json({
                status: true,
                message: 'Update Successful',
                statuscode: StatusCodes.OK,
                data: null,
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
    updatebranch
};