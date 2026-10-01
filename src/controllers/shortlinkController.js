const { nanoid } = require("nanoid");
const pool = require("../config/database");

const BASE_URL = process.env.SHORTLINK_BASE_URL;

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

exports.createShortlink = async (req, res) => {
    try {
        const { original_url, custom_code } = req.body;

        if (!original_url) {
            return res.status(400).json({
                success: false,
                message: "original_url is required",
            });
        }

        const normalizedUrl = normalizeUrl(original_url);

        if (!normalizedUrl) {
            return res.status(400).json({
                success: false,
                message: "Invalid URL",
            });
        }

        let code = custom_code
            ? String(custom_code).trim()
            : nanoid(7);

        if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
            return res.status(400).json({
                success: false,
                message:
                    "custom_code can only contain letters, numbers, underscore and hyphen",
            });
        }

        const [existing] = await pool.query(
            "SELECT id FROM shortlinks WHERE code = ? LIMIT 1",
            [code]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Shortlink code already exists",
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO shortlinks
            (code, original_url)
            VALUES (?, ?)
            `,
            [code, normalizedUrl]
        );

        res.status(201).json({
            success: true,
            message: "Shortlink created",
            data: {
                id: result.insertId,
                code,
                original_url: normalizedUrl,
                short_url: `${BASE_URL}/${code}`,
                status: "active",
            },
        });
    } catch (error) {
        console.error("Create shortlink error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create shortlink",
        });
    }
};

exports.getShortlinks = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.id,
                s.code,
                s.original_url,
                s.status,
                s.created_at,
                s.updated_at,
                COUNT(t.id) AS click_count
            FROM shortlinks s
            LEFT JOIN traffic_logs t
                ON t.shortlink_id = s.id
            GROUP BY
                s.id,
                s.code,
                s.original_url,
                s.status,
                s.created_at,
                s.updated_at
            ORDER BY s.created_at DESC
        `);

        const data = rows.map((row) => ({
            ...row,
            click_count: Number(row.click_count),
            short_url: `${BASE_URL}/${row.code}`,
        }));

        res.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get shortlinks error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get shortlinks",
        });
    }
};

exports.getShortlink = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                s.id,
                s.code,
                s.original_url,
                s.status,
                s.created_at,
                s.updated_at,
                COUNT(t.id) AS click_count
            FROM shortlinks s
            LEFT JOIN traffic_logs t
                ON t.shortlink_id = s.id
            WHERE s.id = ?
            GROUP BY
                s.id,
                s.code,
                s.original_url,
                s.status,
                s.created_at,
                s.updated_at
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Shortlink not found",
            });
        }

        const row = rows[0];

        res.json({
            success: true,
            data: {
                ...row,
                click_count: Number(row.click_count),
                short_url: `${BASE_URL}/${row.code}`,
            },
        });
    } catch (error) {
        console.error("Get shortlink error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get shortlink",
        });
    }
};

exports.updateShortlink = async (req, res) => {
    try {
        const { id } = req.params;
        const { original_url, status } = req.body;

        if (!original_url && !status) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update",
            });
        }

        if (original_url) {
            const normalizedUrl = normalizeUrl(original_url);

            if (!normalizedUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid URL",
                });
            }

            await pool.query(
                `
                UPDATE shortlinks
                SET original_url = ?
                WHERE id = ?
                `,
                [normalizedUrl, id]
            );
        }

        if (status) {
            if (!["active", "inactive"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status",
                });
            }

            await pool.query(
                `
                UPDATE shortlinks
                SET status = ?
                WHERE id = ?
                `,
                [status, id]
            );
        }

        const [rows] = await pool.query(
            "SELECT * FROM shortlinks WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Shortlink not found",
            });
        }

        const row = rows[0];

        res.json({
            success: true,
            message: "Shortlink updated",
            data: {
                ...row,
                short_url: `${BASE_URL}/${row.code}`,
            },
        });
    } catch (error) {
        console.error("Update shortlink error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update shortlink",
        });
    }
};

exports.deleteShortlink = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            "DELETE FROM shortlinks WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Shortlink not found",
            });
        }

        res.json({
            success: true,
            message: "Shortlink deleted",
        });
    } catch (error) {
        console.error("Delete shortlink error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete shortlink",
        });
    }
};
