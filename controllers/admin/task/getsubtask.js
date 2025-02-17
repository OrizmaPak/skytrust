const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");

const getTask = async (req, res) => {
    let { id, startdate, enddate, branch, priority, taskstatus } = req.query;

    try {
        let queryString = `
            SELECT t.*,
            (
                SELECT json_agg(s)
                FROM sky."Subtask" s
                WHERE s.task = t.id
            ) as subtasks,
            b.branch as branchname,
            (
                SELECT string_agg(CONCAT(u.firstname, ' ', u.lastname), ', ')
                FROM sky."User" u
                WHERE u.id = ANY(string_to_array(t.assignedto, '||')::int[])
            ) as assignedtonames,
            t.assignedto
            FROM sky."Task" t
            LEFT JOIN sky."Branch" b ON t.branch = b.id::text
            WHERE 1=1
        `;
        let params = [];

        if (id) {
            queryString += ` AND t.id = $${params.length + 1}`;
            params.push(id);
        }
        if (startdate) {
            queryString += ` AND t.startdate >= $${params.length + 1}`;
            params.push(startdate);
        }
        if (enddate) {
            queryString += ` AND t.enddate <= $${params.length + 1}`;
            params.push(enddate);
        }
        if (branch) {
            queryString += ` AND t.branch = $${params.length + 1}`;
            params.push(branch);
        }
        if (priority) {
            queryString += ` AND t.priority = $${params.length + 1}`;
            params.push(priority);
        }
        if (taskstatus) {
            queryString += ` AND t.taskstatus = $${params.length + 1}`;
            params.push(taskstatus);
        }

        const { rows: tasks } = await pg.query(queryString, params);

        // Filter out tasks with invalid data
        const validTasks = tasks.map(task => {
            try {
                // Attempt to parse assignedto to ensure it's valid
                if (task.assignedto) {
                    JSON.parse(task.assignedto);
                }
                return task;
            } catch (e) {
                console.warn(`Invalid data for task: ${task.id}, setting assignedto and assignedtonames to null`);
                return task;
            }
        });

        if (validTasks.length > 0) {
            await activityMiddleware(req, req.user.id, 'Tasks fetched successfully', 'TASK');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "Tasks fetched successfully",
                statuscode: StatusCodes.OK,
                data: validTasks,
                errors: []
            });
        } else {
            await activityMiddleware(req, req.user.id, 'No tasks found', 'TASK');
            return res.status(StatusCodes.OK).json({
                status: true,
                message: "No tasks found",
                statuscode: StatusCodes.OK,
                data: [],
                errors: []
            });
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
        await activityMiddleware(req, req.user.id, 'An unexpected error occurred fetching tasks', 'TASK');
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
    getTask
};
