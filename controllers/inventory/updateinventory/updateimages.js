const { StatusCodes } = require("http-status-codes");
const pg = require("../../../db/pg");
const { activityMiddleware } = require("../../../middleware/activity");
const { uploadToGoogleDrive } = require("../../../utils/uploadToGoogleDrive");

const updateImages = async (req, res) => {
    const itemid = req.body.itemid;

    if (!itemid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: "Itemid is required",
            statuscode: StatusCodes.BAD_REQUEST,
            data: null,
            errors: ["Itemid is required"]
        });
    }

    try {
        const { rows: item } = await pg.query(`SELECT * FROM sky."Inventory" WHERE itemid = $1`, [itemid]);
        if (!item.length) {
            return res.status(StatusCodes.NOT_FOUND).json({
                status: false,
                message: "Item not found",
                statuscode: StatusCodes.NOT_FOUND,
                data: null,
                errors: ["Item not found"]
            });
        }

        // UPLOAD TO GOOGLEDRIVE
        await uploadToGoogleDrive(req, res);

        const query = `UPDATE sky."Inventory" SET 
            imageone = COALESCE($1, imageone),
            imagetwo = COALESCE($2, imagetwo),
            imagethree = COALESCE($3, imagethree)
        WHERE itemid = $4`;


        await pg.query(query, [req.body.imageone??null, req.body.imagetwo??null, req.body.imagethree??null, itemid]);

        // Log activity for updating images
        await activityMiddleware(res, req.user.id, `Images updated for item ${itemid}`, 'UPDATED INVENTORY IMAGES');

        return res.status(StatusCodes.OK).json({
            status: true,
            message: "Images updated successfully",
            statuscode: StatusCodes.OK,
            data: null,
            errors: []
        });
    } catch (error) {
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal Server Error",
            statuscode: StatusCodes.INTERNAL_SERVER_ERROR,
            data: null,
            errors: []
        });
    }
};

module.exports = { updateImages };
