const express = require("express");

const {
    getTrafficLogs,
    getTrafficSummary,
} = require("../controllers/trafficController");

const router = express.Router();

router.get("/", getTrafficLogs);

router.get("/summary", getTrafficSummary);

module.exports = router;
