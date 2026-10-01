const pool = require("../config/database");

const {
    getTrafficData,
} = require("../utils/traffic");

const {
    getCountryCode,
} = require("../utils/geoip");

const {
    lookupIp,
} = require("../utils/ipIntel");

const {
    evaluatePolicy,
} = require("../utils/policyEvaluator");


const redirectShortlink = async (
    req,
    res
) => {
    try {
        const { code } = req.params;


        /*
         * =====================================
         * 1. FIND SHORTLINK
         * =====================================
         */

        const [
            shortlinks,
        ] = await pool.query(
            `SELECT
                id,
                code,
                original_url,
                status
             FROM shortlinks
             WHERE code = ?
             LIMIT 1`,
            [code]
        );


        if (
            shortlinks.length === 0
        ) {
            return res
                .status(404)
                .send("Shortlink not found");
        }


        const shortlink =
            shortlinks[0];


        /*
         * =====================================
         * 2. CHECK SHORTLINK STATUS
         * =====================================
         */

        if (
            shortlink.status !==
            "active"
        ) {
            return res
                .status(410)
                .send("Shortlink is inactive");
        }


        /*
         * =====================================
         * 3. COLLECT TRAFFIC DATA
         * =====================================
         */

        const traffic =
            getTrafficData(req);


        /*
         * =====================================
         * 4. GEOIP COUNTRY
         * =====================================
         */

        let countryCode =
            await getCountryCode(
                req,
                traffic.ip
            );


        /*
         * =====================================
         * 5. IP INTELLIGENCE
         *
         * IPQS is fail-open.
         *
         * IPQS error / unavailable /
         * timeout must NOT automatically
         * cause fallback.
         * =====================================
         */

        let ipIntel = {
            available: false,
            country_code: "",
            vpn: false,
            proxy: false,
            tor: false,
            datacenter: false,
            risk_type: "unknown",
        };


        try {
            const result =
                await lookupIp(
                    traffic.ip,
                    traffic.user_agent
                );


            if (
                result &&
                result.available === true
            ) {
                ipIntel = {
                    ...ipIntel,
                    ...result,
                };
            }

        } catch (
            ipIntelError
        ) {
            console.error(
                "[IP INTEL] Lookup error:",
                ipIntelError.message
            );
        }


        /*
         * If GeoIP does not resolve the
         * country, use IP Intelligence
         * country as secondary source.
         */

        if (
            !countryCode &&
            ipIntel.available === true &&
            ipIntel.country_code
        ) {
            countryCode =
                ipIntel.country_code;
        }


        /*
         * =====================================
         * 6. FIND ACTIVE POLICY
         * =====================================
         */

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
                status

             FROM shortlink_policies

             WHERE shortlink_id = ?
               AND status = 'active'

             LIMIT 1`,
            [shortlink.id]
        );


        let policy = null;


        /*
         * =====================================
         * 7. NORMALIZE POLICY
         * =====================================
         */

        if (
            policies.length > 0
        ) {
            policy =
                policies[0];


            /*
             * Parse allowed countries
             */

            if (
                typeof policy.allowed_countries ===
                "string"
            ) {
                try {
                    policy.allowed_countries =
                        JSON.parse(
                            policy.allowed_countries
                        );

                } catch {
                    policy.allowed_countries =
                        [];
                }
            }


            /*
             * Parse blocked countries
             */

            if (
                typeof policy.blocked_countries ===
                "string"
            ) {
                try {
                    policy.blocked_countries =
                        JSON.parse(
                            policy.blocked_countries
                        );

                } catch {
                    policy.blocked_countries =
                        [];
                }
            }
        }


        /*
         * =====================================
         * 8. EVALUATE POLICY
         * =====================================
         *
         * IMPORTANT:
         *
         * Policy evaluator determines whether
         * visitor is allowed or fallback.
         *
         * IP Intelligence is passed only when
         * it is actually available.
         *
         * If IPQS is unavailable, null is used
         * so it cannot accidentally trigger
         * fallback.
         */

        const policyResult =
            evaluatePolicy({
                countryCode,

                device:
                    traffic.device,

                userAgent:
                    traffic.user_agent,

                policy,

                ipIntel:
                    ipIntel.available
                        ? ipIntel
                        : null,
            });


        /*
         * =====================================
         * 9. DETERMINE DESTINATION
         * =====================================
         *
         * THIS IS THE IMPORTANT PART.
         *
         * ALLOW
         *   -> original_url
         *
         * FALLBACK
         *   -> policy.fallback_url
         *
         * Landing Pages / Routes are NOT used
         * for the redirect destination here.
         */

        let destinationUrl =
            shortlink.original_url;


        let decision =
            policyResult.allowed
                ? "allowed"
                : "fallback";


        let decisionReason =
            policyResult.reason;


        let destinationType =
            "original_url";


        /*
         * =====================================
         * ALLOWED
         * =====================================
         */

        if (
            policyResult.allowed
        ) {

            destinationUrl =
                shortlink.original_url;

            destinationType =
                "original_url";
        }


        /*
         * =====================================
         * FALLBACK
         * =====================================
         */

        else {

            /*
             * Use policy fallback URL
             * when available.
             */

            if (
                policy &&
                policy.fallback_url
            ) {

                destinationUrl =
                    policy.fallback_url;

                destinationType =
                    "fallback";

            } else {

                /*
                 * If fallback URL is not
                 * configured, fail-open
                 * to original URL.
                 */

                destinationUrl =
                    shortlink.original_url;

                destinationType =
                    "original_url";

                decision =
                    "allowed";

                decisionReason =
                    "fallback_url_not_configured";
            }
        }


        /*
         * =====================================
         * 10. DEBUG HEADERS
         * =====================================
         */

        res.setHeader(
            "X-Policy-Decision",
            decision
        );


        res.setHeader(
            "X-Policy-Reason",
            decisionReason
        );


        res.setHeader(
            "X-Policy-Country",
            countryCode ||
            "UNKNOWN"
        );


        res.setHeader(
            "X-Policy-Device",
            traffic.device ||
            "unknown"
        );


        /*
         * IP Intelligence
         * information only.
         */

        res.setHeader(
            "X-IP-Intel",
            ipIntel.available
                ? "available"
                : "unavailable"
        );


        res.setHeader(
            "X-IP-VPN",
            String(
                ipIntel.vpn || false
            )
        );


        res.setHeader(
            "X-IP-Proxy",
            String(
                ipIntel.proxy || false
            )
        );


        res.setHeader(
            "X-IP-Tor",
            String(
                ipIntel.tor || false
            )
        );


        res.setHeader(
            "X-IP-Datacenter",
            String(
                ipIntel.datacenter || false
            )
        );


        res.setHeader(
            "X-IP-Risk",
            ipIntel.risk_type ||
            "unknown"
        );


        res.setHeader(
            "X-Destination-Type",
            destinationType
        );


        /*
         * =====================================
         * 11. TRAFFIC LOGGING
         * =====================================
         */

        try {

            await pool.query(
                `INSERT INTO traffic_logs
                (
                    shortlink_id,
                    landing_page_id,

                    ip_hash,
                    user_agent,
                    referer,
                    device,
                    country_code,

                    ip_risk_type,
                    vpn_detected,
                    proxy_detected,
                    tor_detected,
                    datacenter_detected,

                    decision,
                    decision_reason,
                    destination_type
                )

                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?
                )`,

                [
                    /*
                     * shortlink
                     */

                    shortlink.id,


                    /*
                     * No landing page is
                     * used by redirect engine.
                     *
                     * Therefore this is NULL.
                     */

                    null,


                    /*
                     * traffic
                     */

                    traffic.ip_hash,

                    traffic.user_agent,

                    traffic.referer,

                    traffic.device,

                    countryCode ||
                        null,


                    /*
                     * IP intelligence
                     */

                    ipIntel.risk_type ||
                        null,


                    ipIntel.available
                        ? (
                            ipIntel.vpn
                                ? 1
                                : 0
                        )
                        : null,


                    ipIntel.available
                        ? (
                            ipIntel.proxy
                                ? 1
                                : 0
                        )
                        : null,


                    ipIntel.available
                        ? (
                            ipIntel.tor
                                ? 1
                                : 0
                        )
                        : null,


                    ipIntel.available
                        ? (
                            ipIntel.datacenter
                                ? 1
                                : 0
                        )
                        : null,


                    /*
                     * decision
                     */

                    decision,

                    decisionReason,

                    destinationType,
                ]
            );

        } catch (
            trafficError
        ) {

            /*
             * Traffic logging failure
             * must never stop redirect.
             */

            console.error(
                "Traffic logging error:",
                trafficError
            );
        }


        /*
         * =====================================
         * 12. CONSOLE LOG
         * =====================================
         */

        console.log(
            `[REDIRECT] ${code}` +
            ` | IP: ${
                traffic.ip ||
                "UNKNOWN"
            }` +
            ` | Country: ${
                countryCode ||
                "UNKNOWN"
            }` +
            ` | Device: ${
                traffic.device
            }` +
            ` | IP Intel: ${
                ipIntel.available
                    ? "AVAILABLE"
                    : "UNAVAILABLE"
            }` +
            ` | VPN: ${
                ipIntel.vpn
            }` +
            ` | Proxy: ${
                ipIntel.proxy
            }` +
            ` | Tor: ${
                ipIntel.tor
            }` +
            ` | Datacenter: ${
                ipIntel.datacenter
            }` +
            ` | Decision: ${
                decision
            }` +
            ` | Reason: ${
                decisionReason
            }` +
            ` | Destination: ${
                destinationType
            }`
        );


        /*
         * =====================================
         * 13. REDIRECT
         * =====================================
         */

        return res.redirect(
            302,
            destinationUrl
        );

    } catch (
        error
    ) {

        console.error(
            "Redirect error:",
            error
        );


        return res
            .status(500)
            .send(
                "Internal server error"
            );
    }
};


module.exports = {
    redirectShortlink,
};