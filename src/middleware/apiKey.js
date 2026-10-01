const crypto = require("crypto");

function apiKey(req, res, next) {
    const configuredKey = process.env.API_KEY;

    if (!configuredKey) {
        console.error("API_KEY is not configured.");
        return res.status(500).json({
            success: false,
            message: "API authentication is not configured",
        });
    }

    const providedKey =
        req.headers["x-api-key"] ||
        req.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!providedKey) {
        return res.status(401).json({
            success: false,
            message: "API key is required",
        });
    }

    const providedBuffer = Buffer.from(providedKey);
    const configuredBuffer = Buffer.from(configuredKey);

    if (
        providedBuffer.length !== configuredBuffer.length ||
        !crypto.timingSafeEqual(
            providedBuffer,
            configuredBuffer
        )
    ) {
        return res.status(403).json({
            success: false,
            message: "Invalid API key",
        });
    }

    next();
}

module.exports = apiKey;
