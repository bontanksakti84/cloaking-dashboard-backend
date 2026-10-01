require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./config/database");

const shortlinkRoutes = require("./routes/shortlinkRoutes");
const landingPageRoutes = require("./routes/landingPageRoutes");
const routeRoutes = require("./routes/routeRoutes");
const trafficRoutes = require("./routes/trafficRoutes");
const policyRoutes = require("./routes/policyRoutes");
const redirectRoutes = require("./routes/redirectRoutes");

const apiKey = require("./middleware/apiKey");

const app = express();

const PORT = process.env.PORT || 4000;

app.disable("x-powered-by");

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);

app.use(
    cors({
        origin: true,
        credentials: false,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Public health check
|--------------------------------------------------------------------------
*/

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT 1 AS connected"
        );

        return res.json({
            success: true,
            message: "Shortlink API is running",
            database: rows[0].connected === 1,
        });
    } catch (error) {
        console.error("Database error:", error);

        return res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

/*
|--------------------------------------------------------------------------
| Management API rate limiter
|--------------------------------------------------------------------------
*/

const managementLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many API requests. Please try again later.",
    },
});

/*
|--------------------------------------------------------------------------
| Protected Management API
|--------------------------------------------------------------------------
*/

app.use(
    "/api/shortlinks",
    managementLimiter,
    apiKey,
    shortlinkRoutes
);

app.use(
    "/api/landing-pages",
    managementLimiter,
    apiKey,
    landingPageRoutes
);

app.use(
    "/api/routes",
    managementLimiter,
    apiKey,
    routeRoutes
);

app.use(
    "/api/policies",
    managementLimiter,
    apiKey,
    policyRoutes
);

app.use(
    "/api/traffic",
    managementLimiter,
    apiKey,
    trafficRoutes
);

/*
|--------------------------------------------------------------------------
| Public Redirect
|--------------------------------------------------------------------------
*/

app.use("/", redirectRoutes);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Endpoint not found",
    });
});

/*
|--------------------------------------------------------------------------
| Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
    console.log("=================================");
    console.log("SHORTLINK API");
    console.log("=================================");
    console.log(`Server : http://localhost:${PORT}`);
    console.log(`Health : http://localhost:${PORT}/api/health`);
    console.log("=================================");
});