function normalizeCountryCode(
    countryCode
) {
    return String(
        countryCode || ""
    )
        .trim()
        .toUpperCase();
}

function normalizeDevice(
    device
) {
    const value =
        String(
            device || ""
        ).toLowerCase();

    if (
        [
            "mobile",
            "desktop",
            "tablet",
        ].includes(value)
    ) {
        return value;
    }

    return "unknown";
}

function detectBot(
    userAgent
) {
    if (!userAgent) {
        return {
            isBot: true,
            reason:
                "missing_user_agent",
        };
    }

    const ua =
        String(
            userAgent
        ).toLowerCase();

    const patterns = [
        "bot",
        "crawler",
        "spider",
        "slurp",
        "headless",
        "curl/",
        "wget/",
        "python-requests",
        "python-urllib",
        "httpclient",
        "scrapy",
        "axios/",
        "postmanruntime",
        "insomnia",
    ];

    for (
        const pattern of patterns
    ) {
        if (
            ua.includes(pattern)
        ) {
            return {
                isBot: true,
                reason:
                    `bot_${pattern}`,
            };
        }
    }

    return {
        isBot: false,
        reason: "not_bot",
    };
}

function evaluateCountry(
    countryCode,
    policy
) {
    const country =
        normalizeCountryCode(
            countryCode
        );

    const mode =
        policy.country_mode ||
        "all";

    const allowed =
        Array.isArray(
            policy.allowed_countries
        )
            ? policy.allowed_countries.map(
                  normalizeCountryCode
              )
            : [];

    const blocked =
        Array.isArray(
            policy.blocked_countries
        )
            ? policy.blocked_countries.map(
                  normalizeCountryCode
              )
            : [];

    if (mode === "all") {
        return {
            allowed: true,
            reason:
                "country_all",
        };
    }

    if (!country) {
        return {
            allowed: false,
            reason:
                "country_unknown",
        };
    }

    if (
        mode ===
        "allowlist"
    ) {
        if (
            allowed.includes(
                country
            )
        ) {
            return {
                allowed: true,
                reason:
                    "country_allowed",
            };
        }

        return {
            allowed: false,
            reason:
                "country_not_allowed",
        };
    }

    if (
        mode ===
        "blocklist"
    ) {
        if (
            blocked.includes(
                country
            )
        ) {
            return {
                allowed: false,
                reason:
                    "country_blocked",
            };
        }

        return {
            allowed: true,
            reason:
                "country_not_blocked",
        };
    }

    return {
        allowed: true,
        reason:
            "country_default",
    };
}

function evaluateDevice(
    device,
    policy
) {
    const mode =
        policy.device_mode ||
        "all";

    if (mode === "all") {
        return {
            allowed: true,
            reason:
                "device_all",
        };
    }

    const normalized =
        normalizeDevice(
            device
        );

    if (
        normalized ===
        mode
    ) {
        return {
            allowed: true,
            reason:
                "device_allowed",
        };
    }

    return {
        allowed: false,
        reason:
            "device_not_allowed",
    };
}

function evaluateBot(
    userAgent,
    policy
) {
    const result =
        detectBot(
            userAgent
        );

    if (!result.isBot) {
        return {
            allowed: true,
            reason: "not_bot",
        };
    }

    if (
        policy.bot_action ===
        "allow"
    ) {
        return {
            allowed: true,
            reason:
                result.reason,
        };
    }

    return {
        allowed: false,
        reason:
            result.reason,
    };
}

function evaluateIpRisk(
    ipIntel,
    policy
) {
    if (
        !ipIntel ||
        !ipIntel.available
    ) {
        return {
            allowed: true,
            reason:
                "ip_intel_unavailable",
        };
    }

    if (
        ipIntel.tor &&
        policy.tor_action ===
            "fallback"
    ) {
        return {
            allowed: false,
            reason:
                "tor_detected",
        };
    }

    if (
        ipIntel.vpn &&
        policy.vpn_action ===
            "fallback"
    ) {
        return {
            allowed: false,
            reason:
                "vpn_detected",
        };
    }

    if (
        ipIntel.proxy &&
        policy.proxy_action ===
            "fallback"
    ) {
        return {
            allowed: false,
            reason:
                "proxy_detected",
        };
    }

    if (
        ipIntel.datacenter &&
        policy.datacenter_action ===
            "fallback"
    ) {
        return {
            allowed: false,
            reason:
                "datacenter_detected",
        };
    }

    return {
        allowed: true,
        reason:
            "ip_risk_allowed",
    };
}

function evaluatePolicy({
    countryCode,
    device,
    userAgent,
    policy,
    ipIntel,
}) {
    if (!policy) {
        return {
            allowed: true,
            reason:
                "no_policy",
        };
    }

    if (
        policy.status !==
        "active"
    ) {
        return {
            allowed: true,
            reason:
                "policy_inactive",
        };
    }

    const countryResult =
        evaluateCountry(
            countryCode,
            policy
        );

    if (
        !countryResult.allowed
    ) {
        return countryResult;
    }

    const deviceResult =
        evaluateDevice(
            device,
            policy
        );

    if (
        !deviceResult.allowed
    ) {
        return deviceResult;
    }

    const botResult =
        evaluateBot(
            userAgent,
            policy
        );

    if (
        !botResult.allowed
    ) {
        return botResult;
    }

    const ipRiskResult =
        evaluateIpRisk(
            ipIntel,
            policy
        );

    if (
        !ipRiskResult.allowed
    ) {
        return ipRiskResult;
    }

    return {
        allowed: true,
        reason:
            "policy_allowed",
    };
}

module.exports = {
    detectBot,
    evaluatePolicy,
};