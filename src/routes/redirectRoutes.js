const express = require("express");

const {
    redirectShortlink,
} = require("../controllers/redirectController");

const router = express.Router();

router.get("/:code", redirectShortlink);

module.exports = router;