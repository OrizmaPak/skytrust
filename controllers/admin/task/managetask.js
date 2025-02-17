const { StatusCodes } = require("http-status-codes"); // Import StatusCodes for HTTP status codes
const pg = require("../../../db/pg"); // Import PostgreSQL client
const { activityMiddleware } = require("../../../middleware/activity"); // Import activity middleware for logging
const { sendEmail } = require("../../../utils/sendEmail"); // Import function to send email

// Function to manage tasks (create or update)
const manageTask = async (req, res) => {
    try {
        // Extract task details from request body
        const user = req.user;
        const { id, title, description, priority, assignedto, branch=user.branch, status, startdate, enddate, taskstatus = "NOT STARTED" } = req.body;

        // Validate required fields with detailed error messages
        const missingFields = [];
        if(!id){if (!title) missingFields.push('Title');
        if (!priority) missingFields.push('Priority');
        if (!branch) missingFields.push('Branch');
        if (!startdate) missingFields.push('Start Date');
        if (!enddate) missingFields.push('End Date');
        if (!taskstatus) missingFields.push('Task Status');}

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

        // Check if the branch exists
        if(!id){
            const { rows: [branchExists] } = await pg.query(`SELECT * FROM sky."Branch" WHERE id = $1`, [branch]);
            if (!branchExists) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    status: false,
                    message: "Branch not found",
                    statuscode: StatusCodes.NOT_FOUND,
                    data: null,
                    errors: []
                });
            }
            
            // Validate start date and end date values
        const startDate = new Date(startdate);
        const endDate = new Date(enddate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Start date and end date must be valid dates",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }

        // Validate end date is after start date
        if (new Date(enddate) <= new Date(startdate)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "End date must be greater than start date",
                statuscode: StatusCodes.BAD_REQUEST,
                data: null,
                errors: []
            });
        }
        
        // Validate priority
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        if (!validPriorities.includes(priority.toUpperCase())) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                status: false,
                message: "Priority must be either LOW, MEDIUM, HIGH, or URGENT",
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
    const { rows: [branchName] } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [branch]);
        // If task ID is provided, update the task
        if (id) {
            // If status is provided, update only the status
            if (status) {
                const { rows: [updatedTask] } = await pg.query(`
                    UPDATE sky."Task"
                    SET status = $1
                    WHERE id = $2
                    RETURNING *
                `, [status, id]);

                if (!updatedTask) { 
                    return res.status(StatusCodes.NOT_FOUND).json({
                        status: false,
                        message: "Task not found",
                        statuscode: StatusCodes.NOT_FOUND,
                        data: null, 
                        errors: []
                    });
                }

                // Log activity for task status update
                
                await activityMiddleware(req, req.user.id, `Task status updated successfully for branch ${branchName.branch}`, 'TASK');
                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Task status updated successfully",
                    statuscode: StatusCodes.OK,
                    data: updatedTask,
                    errors: [] 
                });
            } else { 
                // Update task details
                const { rows: [updatedTask] } = await pg.query(`
                    UPDATE sky."Task"
                    SET title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    priority = COALESCE($3, priority),
                    assignedto = COALESCE($4, assignedto),
                    branch = COALESCE($5, branch),
                    startdate = COALESCE($6, startdate),
                    enddate = COALESCE($7, enddate),
                    taskstatus = COALESCE($8, taskstatus),
                    status = COALESCE($9, status)
                    WHERE id = $10
                    RETURNING *
                `, [title, description, priority, assignedto, branch, startdate, enddate, taskstatus, status, id]);

                if (!updatedTask) {
                    return res.status(StatusCodes.NOT_FOUND).json({
                        status: false,
                        message: "Task not found",
                        statuscode: StatusCodes.NOT_FOUND,
                        data: null,
                        errors: []
                    });
                }

                // Log activity for task update
                const { branch: updatedBranch, title: updatedTitle, description: updatedDescription, priority: updatedPriority, assignedto: updatedAssignedTo, startdate: updatedStartDate, enddate: updatedEndDate, taskstatus: updatedTaskStatus } = updatedTask;

                await activityMiddleware(req, req.user.id, `Task updated successfully for branch ${updatedBranch}`, 'TASK');

                // Send email to the creator
                await sendEmail({
                    to: req.user.email,
                    subject: 'Task Updated',
                    text: `Your task with title ${updatedTitle} has been updated successfully. The new details are: Title: ${updatedTitle}, Description: ${updatedDescription}, Priority: ${updatedPriority}, Assigned To: ${updatedAssignedTo}, Branch: ${updatedBranch}, Start Date: ${updatedStartDate}, End Date: ${updatedEndDate}, Task Status: ${updatedTaskStatus}.`,
                    html: `Your task with title ${updatedTitle} has been updated successfully. The new details are: Title: ${updatedTitle}, Description: ${updatedDescription}, Priority: ${updatedPriority}, Assigned To: ${updatedAssignedTo}, Branch: ${updatedBranch}, Start Date: ${updatedStartDate}, End Date: ${updatedEndDate}, Task Status: ${updatedTaskStatus}.`
                });

                // Send email to the assigned users
                if (assignedto) {
                    const assignedUsers = assignedto.split('||');
                    for (let user of assignedUsers) {
                        const { rows: [assignedUser] } = await pg.query(`SELECT email FROM sky."User" WHERE id = $1`, [user]);
                        if (assignedUser) {
                            await sendEmail({
                                to: assignedUser.email,
                                subject: 'Task Assigned',
                                text: `You have been assigned a new task with title ${title}. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`,
                                html: `You have been assigned a new task with title ${title}. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`
                            });
                        }
                    }
                }

                return res.status(StatusCodes.OK).json({
                    status: true,
                    message: "Task updated successfully",
                    statuscode: StatusCodes.OK,
                    data: updatedTask,
                    errors: []
                });
            }
        } else {
            // Check if a task with the same title already exists for the branch
            const { rows: taskExists } = await pg.query(`
                SELECT * FROM sky."Task"
                WHERE title = $1 AND branch = $2
            `, [title, branch]);

            if (taskExists.length > 0) {
                return res.status(StatusCodes.CONFLICT).json({
                    status: false,
                    message: "Task with the same title already exists for this branch",
                    statuscode: StatusCodes.CONFLICT,
                    data: null,
                    errors: []
                });
            }

            // Create a new task
            const { rows: [newTask] } = await pg.query(`
                INSERT INTO sky."Task" (title, description, priority, assignedto, branch, startdate, enddate, taskstatus, status, createdby)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [title, description, priority, assignedto, branch, startdate, enddate, taskstatus, 'ACTIVE', req.user.id]);

            // Log activity for task creation
            const { rows: [branchName] } = await pg.query(`SELECT branch FROM sky."Branch" WHERE id = $1`, [branch]);
            await activityMiddleware(req, req.user.id, `Task created successfully for branch ${branchName.branch}`, 'TASK');

            // Send email to the creator
            await sendEmail({
                to: req.user.email,
                subject: 'Task Created',
                text: `Your task with title ${title} has been created successfully. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`,
                html: `Your task with title ${title} has been created successfully. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`
            });

            // Send email to the assigned users
            if (assignedto) {
                const assignedUsers = assignedto.split('||');
                for (let user of assignedUsers) {
                    const { rows: [assignedUser] } = await pg.query(`SELECT email FROM sky."User" WHERE id = $1`, [user.id]);
                    if (assignedUser) {
                        await sendEmail({
                            to: assignedUser.email,
                            subject: 'Task Assigned',
                            text: `You have been assigned a new task with title ${title}. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`,
                            html: `You have been assigned a new task with title ${title}. The details are: Title: ${title}, Description: ${description}, Priority: ${priority}, Assigned To: ${assignedto}, Branch: ${branchName.branch}, Start Date: ${startdate}, End Date: ${enddate}, Task Status: ${taskstatus}.`
                        });
                    }
                }
            }

            return res.status(StatusCodes.CREATED).json({
                status: true,
                message: "Task created successfully",
                statuscode: StatusCodes.CREATED,
                data: newTask,
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        // Log activity for unexpected error
        await activityMiddleware(req, req.user.id, `An unexpected error occurred managing task`, 'TASK');
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
    manageTask
};
