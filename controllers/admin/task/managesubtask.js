const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { sendEmail } = require("../../../utils/sendEmail");

const manageSubtask = async (req, res) => { 
    try {
        const { id, task, title, startdate, enddate, description, createdby, assignedto="", taskstatus="NOT STARTED" } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!id) {
            if (!task) missingFields.push('Task');
            if (!title) missingFields.push('Title');
            if (!startdate) missingFields.push('Start Date');
            if (!enddate) missingFields.push('End Date');
        }
        // if (!taskstatus) missingFields.push('Task Status');

        if (missingFields.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: `The following fields are required: ${missingFields.join(', ')}`,
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: missingFields.map(field => ({
                    field,
                    message: `${field} is required`
                }))
            });
        }

        if (!id) {
            // Validate start date and end date
            if (new Date(enddate) <= new Date(startdate)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "End date must be greater than start date",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }

            // Validate task status
            const validTaskStatuses = ['NOT STARTED', 'WORKING ON IT', 'STUCK', 'PENDING', 'DONE'];
            if (!validTaskStatuses.includes(taskstatus.toUpperCase())) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: "Task status must be either NOT STARTED, WORKING ON IT, STUCK, PENDING, or DONE",
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }

        if (id) {
            // Check if subtask exists
            const { rows: [subtaskExists] } = await pg.query(`SELECT * FROM skyeu."Subtask" WHERE id = $1`, [id]);
            if (!subtaskExists) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Subtask not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
        }

        let assignedToIds

        assignedToIds = assignedto ? assignedto.split("||").map(id => id.trim()) : [];
        for (let id of assignedToIds) {
            const { rows: [user] } = await pg.query(`SELECT id FROM skyeu."User" WHERE id = $1`, [id]);
            if (!user) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Assigned to user with ID ${id} does not exist`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        };

       if(!id){ // Check if start date and end date are within task's start and end date
        // if (new Date(startdate) < new Date(taskExists.startdate) || new Date(enddate) > new Date(taskExists.enddate)) {
        //     return res.status(StatusCodes.BAD_REQUEST).json({
        //         status: false,
        //         message: "Start date and end date must be within task's start and end date",
        //         statuscode: StatusCodes.BAD_REQUEST,
        //         data: null,
        //         errors: []
        //     });
        // }

        // Check if assigned to is valid
        assignedToIds = assignedto ? assignedto.split("||").map(id => id.trim()) : [];
        for (let id of assignedToIds) {
            const { rows: [user] } = await pg.query(`SELECT id FROM skyeu."User" WHERE id = $1`, [id]);
            if (!user) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    status: false,
                    message: `Assigned to user with ID ${id} does not exist`,
                    statuscode: StatusCodes.BAD_REQUEST,
                    data: null,
                    errors: []
                });
            }
        }}
        // const assignedToIds = assignedto ? assignedto.split("||").map(id => id.trim()) : [];
        // const { rows: [taskAssignedTo] } = await pg.query(`SELECT assignedto FROM skyeu."Task" WHERE id = $1`, [task]);
        // const taskAssignedToIds = taskAssignedTo.assignedto.split("||");
        // if (!assignedToIds.every(id => taskAssignedToIds.includes(id))) {
        //     return res.status(StatusCodes.BAD_REQUEST).json({
        //         status: false,
        //         message: "Assigned to is not valid",
        //         statuscode: StatusCodes.BAD_REQUEST,
        //         data: null,
        //         errors: []
        //     });
        // }

        

        // Check if title already exists for the task
        if (!id) {
            const { rows: [subtaskExists] } = await pg.query(`SELECT * FROM skyeu."Subtask" WHERE task = $1 AND title = $2`, [task, title]);
            if (subtaskExists) {
                return res.status(StatusCodes.CONFLICT).json({
                    status: false,
                    message: "Subtask with the same title already exists for this task",
                    statuscode: StatusCodes.CONFLICT,
                    data: null,
                    errors: []
                });
            }
        }

        // Create or update subtask
        if (id) {
            // Update assignedto field correctly
            const { rows: [updatedSubtask] } = await pg.query(`UPDATE skyeu."Subtask" SET title = COALESCE($1, title), startdate = COALESCE($2, startdate), enddate = COALESCE($3, enddate), description = COALESCE($4, description), assignedto = COALESCE($5, assignedto), taskstatus = COALESCE($6, taskstatus) WHERE id = $7 RETURNING *`, [title, startdate, enddate, description, assignedto, taskstatus, id]);
            if (!updatedSubtask) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Subtask not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            // Send mail to assignedto
            if (assignedto) {
                console.log('assignedto', assignedToIds)   
                assignedToIds.forEach(async id => {
                    const { rows: [user] } = await pg.query(`SELECT email FROM skyeu."User" WHERE id = $1`, [id]);
                    if (user) {
                        console.log('email', user.email)
                       await sendEmail({
                           to: user.email,
                           subject: `Subtask updated: ${title}`,
                           text: `The subtask ${title} has been updated. New details: Title: ${title}, Start Date: ${startdate}, End Date: ${enddate}, Description: ${description}, Task Status: ${taskstatus}.`,
                           html: `The subtask ${title} has been updated. New details: Title: ${title}, Start Date: ${startdate}, End Date: ${enddate}, Description: ${description}, Task Status: ${taskstatus}.`
                       });
                    }
                });
            }
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Subtask updated successfully",
                statuscode: StatusCodes.OK,
                data: updatedSubtask,
                errors: []
            });
        } else {
            const { rows: [newSubtask] } = await pg.query(`INSERT INTO skyeu."Subtask" (task, title, startdate, enddate, description, createdby, assignedto, taskstatus) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [task, title, startdate, enddate, description, req.user.id, assignedto, taskstatus]);
            // Send mail to assignedto
            if (assignedto) {
                assignedToIds.forEach(async id => {
                    const { rows: [user] } = await pg.query(`SELECT email FROM skyeu."User" WHERE id = $1`, [id]);
                    if (user) {
                        sendEmail(user.email, `New subtask: ${title}`, `A new subtask ${title} has been created.`);
                    }
                });
            }
            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Subtask created successfully",
                statuscode: StatusCodes.CREATED,
                data: newSubtask,
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
    manageSubtask
};
