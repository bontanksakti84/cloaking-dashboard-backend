const pool = require("../config/database");

const getTrafficLogs = async (req, res) => {
    try {
        const limit = Math.min(
            Number(req.query.limit) || 50,
            500
        );

        const [rows] = await pool.query(
            `SELECT
                tl.id,
                tl.shortlink_id,
                s.code AS shortlink_code,

                tl.landing_page_id,
                lp.name AS landing_page_name,

                tl.ip_hash,
                tl.user_agent,
                tl.referer,
                tl.device,
                tl.country,
                tl.created_at

             FROM traffic_logs tl

             INNER JOIN shortlinks s
                ON s.id = tl.shortlink_id

             LEFT JOIN landing_pages lp
                ON lp.id = tl.landing_page_id

             ORDER BY tl.created_at DESC

             LIMIT ?`,
            [limit]
        );

        return res.json({
            success: true,
            data: rows,
        });

    } catch (error) {
        console.error("Get traffic logs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get traffic logs",
        });
    }
};


const getTrafficSummary = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total_clicks,
                COUNT(DISTINCT ip_hash) AS unique_visitors,

                COUNT(
                    DISTINCT CASE
                        WHEN device = 'mobile'
                        THEN ip_hash
                    END
                ) AS mobile_visitors,

                COUNT(
                    DISTINCT CASE
                        WHEN device = 'desktop'
                        THEN ip_hash
                    END
                ) AS desktop_visitors,

                COUNT(
                    DISTINCT CASE
                        WHEN device = 'tablet'
                        THEN ip_hash
                    END
                ) AS tablet_visitors

             FROM traffic_logs`
        );

        return res.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("Traffic summary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get traffic summary",
        });
    }
};


module.exports = {
    getTrafficLogs,
    getTrafficSummary,
};
