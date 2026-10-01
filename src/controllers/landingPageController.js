const pool = require("../config/database");

function normalizeUrl(url) {
    try {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
}

exports.createLandingPage = async (req, res) => {
    try {
        const {
            name,
            url,
            description = null,
        } = req.body;

        if (!name || !url) {
            return res.status(400).json({
                success: false,
                message: "name and url are required",
            });
        }

        const normalizedUrl = normalizeUrl(url);

        if (!normalizedUrl) {
            return res.status(400).json({
                success: false,
                message: "Invalid URL",
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO landing_pages
            (name, url, description)
            VALUES (?, ?, ?)
            `,
            [name.trim(), normalizedUrl, description]
        );

        const [rows] = await pool.query(
            `
            SELECT *
            FROM landing_pages
            WHERE id = ?
            `,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Landing page created",
            data: rows[0],
        });
    } catch (error) {
        console.error("Create landing page error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create landing page",
        });
    }
};

exports.getLandingPages = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                lp.id,
                lp.name,
                lp.url,
                lp.description,
                lp.status,
                lp.created_at,
                lp.updated_at,
                COUNT(r.id) AS route_count
            FROM landing_pages lp
            LEFT JOIN routes r
                ON r.landing_page_id = lp.id
                AND r.status = 'active'
            GROUP BY
                lp.id,
                lp.name,
                lp.url,
                lp.description,
                lp.status,
                lp.created_at,
                lp.updated_at
            ORDER BY lp.created_at DESC
        `);

        const data = rows.map((row) => ({
            ...row,
            route_count: Number(row.route_count),
        }));

        res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get landing pages error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get landing pages",
        });
    }
};

exports.getLandingPage = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                id,
                name,
                url,
                description,
                status,
                created_at,
                updated_at
            FROM landing_pages
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Landing page not found",
            });
        }

        res.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get landing page error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get landing page",
        });
    }
};

exports.updateLandingPage = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            url,
            description,
            status,
        } = req.body;

        const [existing] = await pool.query(
            `
            SELECT *
            FROM landing_pages
            WHERE id = ?
            `,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Landing page not found",
            });
        }

        if (url !== undefined) {
            const normalizedUrl = normalizeUrl(url);

            if (!normalizedUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid URL",
                });
            }

            await pool.query(
                `
                UPDATE landing_pages
                SET url = ?
                WHERE id = ?
                `,
                [normalizedUrl, id]
            );
        }

        if (name !== undefined) {
            await pool.query(
                `
                UPDATE landing_pages
                SET name = ?
                WHERE id = ?
                `,
                [name.trim(), id]
            );
        }

        if (description !== undefined) {
            await pool.query(
                `
                UPDATE landing_pages
                SET description = ?
                WHERE id = ?
                `,
                [description, id]
            );
        }

        if (status !== undefined) {
            if (!["active", "inactive"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status",
                });
            }

            await pool.query(
                `
                UPDATE landing_pages
                SET status = ?
                WHERE id = ?
                `,
                [status, id]
            );
        }

        const [rows] = await pool.query(
            `
            SELECT *
            FROM landing_pages
            WHERE id = ?
            `,
            [id]
        );

        res.json({
            success: true,
            message: "Landing page updated",
            data: rows[0],
        });
    } catch (error) {
        console.error("Update landing page error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update landing page",
        });
    }
};

exports.deleteLandingPage = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `
            DELETE FROM landing_pages
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Landing page not found",
            });
        }

        res.json({
            success: true,
            message: "Landing page deleted",
        });
    } catch (error) {
        console.error("Delete landing page error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete landing page",
        });
    }
};