const express = require("express");

const {
    createLandingPage,
    getLandingPages,
    getLandingPage,
    updateLandingPage,
    deleteLandingPage,
} = require("../controllers/landingPageController");

const router = express.Router();

router.post("/", createLandingPage);

router.get("/", getLandingPages);

router.get("/:id", getLandingPage);

router.put("/:id", updateLandingPage);

router.delete("/:id", deleteLandingPage);

module.exports = router;