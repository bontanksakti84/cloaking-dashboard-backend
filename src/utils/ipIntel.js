const http = require("http");
const https = require("https");

function isEnabled() {
    return (
        String(
            process.env.IPQS_ENABLED || ""
        ).toLowerCase() === "true" &&
        Boolean(
            process.env.IPQS_API_KEY
        )
    );
}

function normalizeBoolean(value) {
    return value === true;
}

function detectRiskType(result) {
    if (!result) {
        return "unknown";
    }

    if (
        normalizeBoolean(
            result.tor
        ) ||
        normalizeBoolean(
            result.active_tor
        )
    ) {
        return "tor";
    }

    if (
        normalizeBoolean(
            result.vpn
        ) ||
        normalizeBoolean(
            result.active_vpn
        )
    ) {
        return "vpn";
    }

    if (
        normalizeBoolean(
            result.proxy
        )
    ) {
        return "proxy";
    }

    if (
        String(
            result.connection_type ||
            ""
        ).toLowerCase() ===
        "data center"
    ) {
        return "datacenter";
    }

    return "normal";
}

function requestJson(url, timeoutMs) {
    return new Promise(
        (resolve, reject) => {
            const client =
                url.startsWith(
                    "https://"
                )
                    ? https
                    : http;

            const request =
                client.get(
                    url,
                    {
                        timeout:
                            timeoutMs,

                        headers: {
                            Accept:
                                "application/json",
                            "User-Agent":
                                "Shortlink-Dashboard/1.0",
                        },
                    },
                    (response) => {
                        let body = "";

                        response.on(
                            "data",
                            (chunk) => {
                                body +=
                                    chunk;
                            }
                        );

                        response.on(
                            "end",
                            () => {
                                if (
                                    response.statusCode <
                                        200 ||
                                    response.statusCode >=
                                        300
                                ) {
                                    return reject(
                                        new Error(
                                            `IPQS HTTP ${response.statusCode}`
                                        )
                                    );
                                }

                                try {
                                    const data =
                                        JSON.parse(
                                            body
                                        );

                                    resolve(
                                        data
                                    );
                                } catch {
                                    reject(
                                        new Error(
                                            "Invalid IPQS JSON response"
                                        )
                                    );
                                }
                            }
                        );
                    }
                );

            request.on(
                "timeout",
                () => {
                    request.destroy();

                    reject(
                        new Error(
                            "IPQS request timeout"
                        )
                    );
                }
            );

            request.on(
                "error",
                reject
            );
        }
    );
}

async function lookupIp(
    ip,
    userAgent = ""
) {
    if (!isEnabled()) {
        return {
            enabled: false,
            available: false,
            ip,
            country_code: "",
            vpn: false,
            proxy: false,
            tor: false,
            datacenter: false,
            risk_type: "unknown",
        };
    }

    if (!ip) {
        return {
            enabled: true,
            available: false,
            ip: "",
            country_code: "",
            vpn: false,
            proxy: false,
            tor: false,
            datacenter: false,
            risk_type: "unknown",
        };
    }

    const apiKey =
        process.env.IPQS_API_KEY;

    const strictness =
        Number(
            process.env
                .IPQS_STRICTNESS || 0
        );

    const timeoutMs =
        Number(
            process.env
                .IPQS_TIMEOUT_MS ||
                2500
        );

    const params =
        new URLSearchParams();

    params.set(
        "strictness",
        String(strictness)
    );

    params.set(
        "allow_public_access_points",
        "true"
    );

    if (userAgent) {
        params.set(
            "user_agent",
            userAgent
        );
    }

    const url =
        `https://www.ipqualityscore.com/api/json/ip/` +
        `${encodeURIComponent(apiKey)}/` +
        `${encodeURIComponent(ip)}?` +
        `${params.toString()}`;

    try {
        const result =
            await requestJson(
                url,
                timeoutMs
            );

        if (
            result.success === false
        ) {
            console.error(
                "[IPQS] API error:",
                result.message ||
                    "Unknown error"
            );

            return {
                enabled: true,
                available: false,
                ip,
                country_code:
                    result.country_code ||
                    "",
                vpn: false,
                proxy: false,
                tor: false,
                datacenter: false,
                risk_type: "unknown",
            };
        }

        const vpn =
            normalizeBoolean(
                result.vpn
            ) ||
            normalizeBoolean(
                result.active_vpn
            );

        const tor =
            normalizeBoolean(
                result.tor
            ) ||
            normalizeBoolean(
                result.active_tor
            );

        const proxy =
            normalizeBoolean(
                result.proxy
            );

        const datacenter =
            String(
                result.connection_type ||
                    ""
            ).toLowerCase() ===
            "data center";

        return {
            enabled: true,
            available: true,

            ip,

            country_code:
                String(
                    result.country_code ||
                        ""
                ).toUpperCase(),

            vpn,

            proxy,

            tor,

            datacenter,

            risk_type:
                detectRiskType(
                    result
                ),

            isp:
                result.ISP || "",

            organization:
                result.Organization ||
                "",

            asn:
                result.ASN || null,

            connection_type:
                result.connection_type ||
                "",

            fraud_score:
                result.fraud_score ??
                null,
        };
    } catch (error) {
        console.error(
            "[IPQS] Lookup failed:",
            error.message
        );

        return {
            enabled: true,
            available: false,

            ip,

            country_code: "",

            vpn: false,
            proxy: false,
            tor: false,
            datacenter: false,

            risk_type: "unknown",
        };
    }
}

module.exports = {
    isEnabled,
    lookupIp,
};