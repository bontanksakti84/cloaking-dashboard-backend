const pool = require("../config/database");

function normalizeCountries(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .map((country) =>
                    String(country)
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        ),
    ];
}

function parseJsonArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch {
        return [];
    }
}

function normalizePolicy(policy) {
    if (!policy) {
        return null;
    }

    return {
        ...policy,

        allowed_countries:
            parseJsonArray(
                policy.allowed_countries
            ),

        blocked_countries:
            parseJsonArray(
                policy.blocked_countries
            ),
    };
}

function validateUrl(url) {
    try {
        const parsed =
            new URL(url);

        return [
            "http:",
            "https:",
        ].includes(
            parsed.protocol
        );
    } catch {
        return false;
    }
}

async function getPolicy(
    req,
    res
) {
    try {
        const shortlinkId =
            Number(
                req.params.shortlinkId
            );

        if (
            !Number.isInteger(
                shortlinkId
            ) ||
            shortlinkId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid shortlink ID",
            });
        }

        const [
            policies,
        ] = await pool.query(
            `SELECT
                id,
                shortlink_id,
                country_mode,
                allowed_countries,
                blocked_countries,
                device_mode,
                bot_action,
                vpn_action,
                proxy_action,
                tor_action,
                datacenter_action,
                fallback_url,
                status,
                created_at,
                updated_at
             FROM shortlink_policies
             WHERE shortlink_id = ?
             LIMIT 1`,
            [shortlinkId]
        );

        if (
            policies.length === 0
        ) {
            return res.json({
                success: true,
                data: null,
            });
        }

        return res.json({
            success: true,
            data: normalizePolicy(
                policies[0]
            ),
        });
    } catch (error) {
        console.error(
            "Get policy error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to get policy",
        });
    }
}

async function createOrUpdatePolicy(
    req,
    res
) {
    try {
        const shortlinkId =
            Number(
                req.params.shortlinkId
            );

        if (
            !Number.isInteger(
                shortlinkId
            ) ||
            shortlinkId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid shortlink ID",
            });
        }

        const {
            country_mode = "all",
            allowed_countries = [],
            blocked_countries = [],
            device_mode = "all",
            bot_action = "deny",

            vpn_action = "allow",
            proxy_action = "allow",
            tor_action = "allow",
            datacenter_action = "allow",

            fallback_url,
            status = "active",
        } = req.body;

        const validCountryModes = [
            "all",
            "allowlist",
            "blocklist",
        ];

        const validDeviceModes = [
            "all",
            "mobile",
            "desktop",
            "tablet",
        ];

        const validBotActions = [
            "allow",
            "deny",
        ];

        const validRiskActions = [
            "allow",
            "fallback",
        ];

        const validStatuses = [
            "active",
            "inactive",
        ];

        if (
            !validCountryModes.includes(
                country_mode
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid country_mode",
            });
        }

        if (
            !validDeviceModes.includes(
                device_mode
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid device_mode",
            });
        }

        if (
            !validBotActions.includes(
                bot_action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid bot_action",
            });
        }

        if (
            !validRiskActions.includes(
                vpn_action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid vpn_action",
            });
        }

        if (
            !validRiskActions.includes(
                proxy_action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid proxy_action",
            });
        }

        if (
            !validRiskActions.includes(
                tor_action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid tor_action",
            });
        }

        if (
            !validRiskActions.includes(
                datacenter_action
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid datacenter_action",
            });
        }

        if (
            !validStatuses.includes(
                status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid status",
            });
        }

        if (
            !fallback_url ||
            !validateUrl(
                fallback_url
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid HTTP/HTTPS fallback URL is required",
            });
        }

        const [
            shortlinks,
        ] = await pool.query(
            `SELECT id
             FROM shortlinks
             WHERE id = ?
             LIMIT 1`,
            [shortlinkId]
        );

        if (
            shortlinks.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Shortlink not found",
            });
        }

        const allowedCountries =
            normalizeCountries(
                allowed_countries
            );

        const blockedCountries =
            normalizeCountries(
                blocked_countries
            );

        await pool.query(
            `INSERT INTO shortlink_policies
            (
                shortlink_id,
                country_mode,
                allowed_countries,
                blocked_countries,
                device_mode,
                bot_action,
                vpn_action,
                proxy_action,
                tor_action,
                datacenter_action,
                fallback_url,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                country_mode = VALUES(country_mode),
                allowed_countries = VALUES(allowed_countries),
                blocked_countries = VALUES(blocked_countries),
                device_mode = VALUES(device_mode),
                bot_action = VALUES(bot_action),
                vpn_action = VALUES(vpn_action),
                proxy_action = VALUES(proxy_action),
                tor_action = VALUES(tor_action),
                datacenter_action = VALUES(datacenter_action),
                fallback_url = VALUES(fallback_url),
                status = VALUES(status)`,
            [
                shortlinkId,
                country_mode,
                JSON.stringify(
                    allowedCountries
                ),
                JSON.stringify(
                    blockedCountries
                ),
                device_mode,
                bot_action,
                vpn_action,
                proxy_action,
                tor_action,
                datacenter_action,
                fallback_url,
                status,
            ]
        );

        const [
            policies,
        ] = await pool.query(
            `SELECT
                id,
                shortlink_id,
                country_mode,
                allowed_countries,
                blocked_countries,
                device_mode,
                bot_action,
                vpn_action,
                proxy_action,
                tor_action,
                datacenter_action,
                fallback_url,
                status,
                created_at,
                updated_at
             FROM shortlink_policies
             WHERE shortlink_id = ?
             LIMIT 1`,
            [shortlinkId]
        );

        return res.json({
            success: true,
            message:
                "Policy saved successfully",
            data: normalizePolicy(
                policies[0]
            ),
        });
    } catch (error) {
        console.error(
            "Save policy error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to save policy",
        });
    }
}

async function deletePolicy(
    req,
    res
) {
    try {
        const shortlinkId =
            Number(
                req.params.shortlinkId
            );

        if (
            !Number.isInteger(
                shortlinkId
            ) ||
            shortlinkId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid shortlink ID",
            });
        }

        const [
            result,
        ] = await pool.query(
            `DELETE FROM shortlink_policies
             WHERE shortlink_id = ?`,
            [shortlinkId]
        );

        if (
            result.affectedRows === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Policy not found",
            });
        }

        return res.json({
            success: true,
            message:
                "Policy deleted successfully",
        });
    } catch (error) {
        console.error(
            "Delete policy error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete policy",
        });
    }
}

module.exports = {
    getPolicy,
    createOrUpdatePolicy,
    deletePolicy,
};