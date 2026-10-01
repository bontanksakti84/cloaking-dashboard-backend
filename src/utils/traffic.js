const crypto = require("crypto");

function getClientIp(req) {
    const cfConnectingIp =
        req.headers["cf-connecting-ip"];

    if (cfConnectingIp) {
        return String(
            cfConnectingIp
        ).trim();
    }

    const forwardedFor =
        req.headers["x-forwarded-for"];

    if (forwardedFor) {
        const parts =
            String(forwardedFor)
                .split(",");

        if (parts.length > 0) {
            return parts[0].trim();
        }
    }

    return (
        req.socket?.remoteAddress ||
        req.ip ||
        ""
    );
}

function hashIp(ip) {
    if (!ip) {
        return null;
    }

    const salt =
        process.env.IP_HASH_SALT ||
        "default-development-salt";

    return crypto
        .createHash("sha256")
        .update(`${salt}:${ip}`)
        .digest("hex");
}

function detectDevice(userAgent) {
    if (!userAgent) {
        return "unknown";
    }

    const ua =
        userAgent.toLowerCase();

    if (
        /ipad|tablet|playbook|silk/i.test(
            ua
        )
    ) {
        return "tablet";
    }

    if (
        /mobile|iphone|ipod|android.*mobile|windows phone/i.test(
            ua
        )
    ) {
        return "mobile";
    }

    if (
        /windows|macintosh|linux|x11/i.test(
            ua
        )
    ) {
        return "desktop";
    }

    return "unknown";
}

function getTrafficData(req) {
    const ip =
        getClientIp(req);

    const userAgent =
        req.headers["user-agent"] || "";

    const referer =
        req.headers["referer"] ||
        req.headers["referrer"] ||
        "";

    return {
        ip,
        ip_hash: hashIp(ip),
        user_agent: userAgent,
        referer,
        device: detectDevice(
            userAgent
        ),
    };
}

module.exports = {
    getClientIp,
    hashIp,
    detectDevice,
    getTrafficData,
};