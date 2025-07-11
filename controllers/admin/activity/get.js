const { StatusCodes } = require("http-status-codes");
const { activityMiddleware } = require("../../../middleware/activity"); // Added tracker middleware
const fs = require('fs');
const path = require('path');
const pg = require("../../../db/pg");

const getActivity = async (req, res) => {
    const { startdate, enddate, userid, module, status } = req.query;
    const user = req.user;

    try {
        // Fetch activities based on date range
        const activityFiles = fs.readdirSync(path.join(__dirname, '../../../activities'));
        console.log(activityFiles);
        let activities = activityFiles
            .filter(file => {
                const fileDate = new Date(file.split('.')[0]);
                if (!startdate && !enddate) return true; // Fetch all if no dates provided
                if (startdate && !enddate) return fileDate >= new Date(startdate);
                if (!startdate && enddate) return fileDate <= new Date(enddate);
                return fileDate >= new Date(startdate) && fileDate <= new Date(enddate);
            })
            .map(file => {
                try {
                    const fileData = fs.readFileSync(path.join(__dirname, '../../../activities', file), 'utf8');
                    return fileData.split('\n').map(line => {
                        if (line.trim() === "") return null; // Skip empty lines
                        try {
                            return JSON.parse(line);
                        } catch (err) {
                            console.error(`Error parsing JSON line in file ${file}:`, err);
                            return null; // Skip this line if parsing fails
                        }
                    }).filter(activity => activity !== null); // Filter out null values
                } catch (err) {
                    console.error(`Error reading file ${file}:`, err);
                    return [];
                }
            });

        // Flatten the array of arrays
        activities = activities.flat();

        // Filter activities based on properties
        if (userid) {
            activities = activities.filter(activity => activity.userid == userid);
        }
        if (module) {
            activities = activities.filter(activity => activity.module == module);
        }
        if (status) {
            activities = activities.filter(activity => activity.status == status);
        }

        let {rows: alluser} = await pg.query(`SELECT u.id, u.firstname, u.lastname, u.othernames, u.phone, u.country AS usercountry, b.branch AS branchname, b.country AS branchcountry, b.state AS branchstate, b.lga AS branchlga, b.address AS branchaddress FROM skyeu."User" u LEFT JOIN skyeu."Branch" b ON u.branch = b.id`)
 
        activities = activities.map(activity => {
            const userDetail = alluser.find(user => user.id == activity.userid);
            if (userDetail) {
                return {
                    ...activity,
                    fullname: `${userDetail.firstname} ${userDetail.lastname} ${userDetail.othernames}`,
                    phone: userDetail.phone,
                    country: userDetail.usercountry,
                    branch: userDetail.branchname,
                    branchaddress: userDetail.branchaddress,
                    branchstate: userDetail.branchstate,
                    branchlga: userDetail.branchlga,
                    branchcountry: userDetail.branchcountry
                };
            }
            return activity; // Return the activity as is if no matching user detail is found
        });

        // Return the activities 
        if (activities.length > 0) {
            await activityMiddleware(req, user.id, 'Activities fetched successfully', 'ACTIVITY'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Activities fetched successfully",
                statuscode: StatusCodes.OK,
                data: activities,
                total: activities.length,
                errors: []
                });
        } else {
            await activityMiddleware(req, user.id, 'No activities found', 'ACTIVITY'); // Tracker middleware
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No activities found",
                statuscode: StatusCodes.OK,
                data: [],
                errors: []
            });
        } 
    } catch (err) {
        console.error('Error fetching activities:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Error fetching activities",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: [err.message]
        });
    }
};

module.exports = {
    getActivity
};
