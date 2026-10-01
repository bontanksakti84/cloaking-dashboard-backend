
const pool = require("../config/database");

function isValidId(value) {
    return /^\d+$/.test(String(value));
}

// CREATE ROUTE
const createRoute = async (req, res) => {
    try {
        const { shortlink_id, landing_page_id, status = "active" } = req.body;

        if (!isValidId(shortlink_id) || !isValidId(landing_page_id)) {
            return res.status(400).json({
                success: false,
                message: "shortlink_id and landing_page_id are required",
            });
        }

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status",
            });
        }

        // Check shortlink
        const [shortlinks] = await pool.query(
            `SELECT id, code, status
             FROM shortlinks
             WHERE id = ?`,
            [shortlink_id]
        );

        if (shortlinks.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Shortlink not found",
            });
        }

        // Check landing page
        const [landingPages] = await pool.query(
            `SELECT id, name, url, status
             FROM landing_pages
             WHERE id = ?`,
            [landing_page_id]
        );

        if (landingPages.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Landing page not found",
            });
        }

        // Check existing route
        const [existingRoutes] = await pool.query(
            `SELECT id
             FROM routes
             WHERE shortlink_id = ?`,
            [shortlink_id]
        );

        if (existingRoutes.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This shortlink already has a route",
                route_id: existingRoutes[0].id,
            });
        }

        const [result] = await pool.query(
            `INSERT INTO routes
             (
                 shortlink_id,
                 landing_page_id,
                 status
             )
             VALUES (?, ?, ?)`,
            [
                shortlink_id,
                landing_page_id,
                status,
            ]
        );

        const [rows] = await pool.query(
            `SELECT
                r.id,
                r.shortlink_id,
                s.code AS shortlink_code,
                s.original_url,
                r.landing_page_id,
                lp.name AS landing_page_name,
                lp.url AS landing_page_url,
                r.status,
                r.created_at,
                r.updated_at
             FROM routes r
             INNER JOIN shortlinks s
                ON s.id = r.shortlink_id
             INNER JOIN landing_pages lp
                ON lp.id = r.landing_page_id
             WHERE r.id = ?`,
            [result.insertId]
        );

        return res.status(201).json({
            success: true,
            message: "Route created successfully",
            data: rows[0],
        });

    } catch (error) {
        console.error("Create route error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create route",
        });
    }
};


// GET ALL ROUTES
const getRoutes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                r.id,
                r.shortlink_id,
                s.code AS shortlink_code,
                s.original_url,
                s.status AS shortlink_status,

                r.landing_page_id,
                lp.name AS landing_page_name,
                lp.url AS landing_page_url,
                lp.status AS landing_page_status,

                r.status,
                r.created_at,
                r.updated_at

             FROM routes r

             INNER JOIN shortlinks s
                ON s.id = r.shortlink_id

             INNER JOIN landing_pages lp
                ON lp.id = r.landing_page_id

             ORDER BY r.created_at DESC`
        );

        return res.json({
            success: true,
            data: rows,
        });

    } catch (error) {
        console.error("Get routes error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get routes",
        });
    }
};


// GET SINGLE ROUTE
const getRoute = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid route ID",
            });
        }

        const [rows] = await pool.query(
            `SELECT
                r.id,
                r.shortlink_id,
                s.code AS shortlink_code,
                s.original_url,
                s.status AS shortlink_status,

                r.landing_page_id,
                lp.name AS landing_page_name,
                lp.url AS landing_page_url,
                lp.status AS landing_page_status,

                r.status,
                r.created_at,
                r.updated_at

             FROM routes r

             INNER JOIN shortlinks s
                ON s.id = r.shortlink_id

             INNER JOIN landing_pages lp
                ON lp.id = r.landing_page_id

             WHERE r.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        return res.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("Get route error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get route",
        });
    }
};


// UPDATE ROUTE
const updateRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            landing_page_id,
            status,
        } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid route ID",
            });
        }

        const [existing] = await pool.query(
            `SELECT id
             FROM routes
             WHERE id = ?`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        const updates = [];
        const values = [];

        if (landing_page_id !== undefined) {
            if (!isValidId(landing_page_id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid landing_page_id",
                });
            }

            const [landingPages] = await pool.query(
                `SELECT id
                 FROM landing_pages
                 WHERE id = ?`,
                [landing_page_id]
            );

            if (landingPages.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Landing page not found",
                });
            }

            updates.push("landing_page_id = ?");
            values.push(landing_page_id);
        }

        if (status !== undefined) {
            if (!["active", "inactive"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status",
                });
            }

            updates.push("status = ?");
            values.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update",
            });
        }

        values.push(id);

        await pool.query(
            `UPDATE routes
             SET ${updates.join(", ")},
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            values
        );

        const [rows] = await pool.query(
            `SELECT
                r.id,
                r.shortlink_id,
                s.code AS shortlink_code,
                s.original_url,

                r.landing_page_id,
                lp.name AS landing_page_name,
                lp.url AS landing_page_url,

                r.status,
                r.created_at,
                r.updated_at

             FROM routes r

             INNER JOIN shortlinks s
                ON s.id = r.shortlink_id

             INNER JOIN landing_pages lp
                ON lp.id = r.landing_page_id

             WHERE r.id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Route updated successfully",
            data: rows[0],
        });

    } catch (error) {
        console.error("Update route error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update route",
        });
    }
};


// DELETE ROUTE
const deleteRoute = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid route ID",
            });
        }

        const [result] = await pool.query(
            `DELETE FROM routes
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Route not found",
            });
        }

        return res.json({
            success: true,
            message: "Route deleted successfully",
        });

    } catch (error) {
        console.error("Delete route error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete route",
        });
    }
};


module.exports = {
    createRoute,
    getRoutes,
    getRoute,
    updateRoute,
    deleteRoute,
};
