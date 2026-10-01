const fs = require("fs");
const path = require("path");
const { Reader } = require("@maxmind/geoip2-node");

let geoipReader = null;
let initializationPromise = null;

const DATABASE_PATH = path.join(
    process.cwd(),
    "GeoLite2-Country.mmdb"
);

async function loadGeoIP() {
    if (geoipReader) {
        return geoipReader;
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    if (!fs.existsSync(DATABASE_PATH)) {
        console.warn(
            `[GeoIP] Database not found: ${DATABASE_PATH}`
        );

        return null;
    }

    initializationPromise = Reader.open(
        DATABASE_PATH
    )
        .then((reader) => {
            geoipReader = reader;

            console.log(
                `[GeoIP] Database loaded: ${DATABASE_PATH}`
            );

            return reader;
        })
        .catch((error) => {
            console.error(
                "[GeoIP] Failed to load database:",
                error.message
            );

            initializationPromise = null;

            return null;
        });

    return initializationPromise;
}

function normalizeIp(ipAddress) {
    if (!ipAddress) {
        return "";
    }

    let ip = String(ipAddress).trim();

    // Remove IPv4-mapped IPv6 prefix
    if (ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }

    return ip;
}

async function lookupCountry(ipAddress) {
    const ip = normalizeIp(ipAddress);

    if (!ip) {
        return "";
    }

    const reader = await loadGeoIP();

    if (!reader) {
        return "";
    }

    try {
        const result = reader.country(ip);

        return (
            result?.country?.isoCode ||
            ""
        ).toUpperCase();
    } catch (error) {
        console.error(
            `[GeoIP] Lookup failed for ${ip}:`,
            error.message
        );

        return "";
    }
}

async function getCountryCode(req, clientIp) {
    /*
     * Cloudflare provides the visitor country
     * through CF-IPCountry.
     */
    const cloudflareCountry =
        req.headers["cf-ipcountry"];

    if (
        cloudflareCountry &&
        cloudflareCountry !== "XX" &&
        cloudflareCountry !== "T1"
    ) {
        return String(
            cloudflareCountry
        ).toUpperCase();
    }

    /*
     * Otherwise use local MaxMind database.
     */
    return lookupCountry(clientIp);
}

module.exports = {
    getCountryCode,
    lookupCountry,
};