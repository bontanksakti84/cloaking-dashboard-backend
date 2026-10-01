const express = require("express");

const {
    createShortlink,
    getShortlinks,
    getShortlink,
    updateShortlink,
    deleteShortlink,
} = require("../controllers/shortlinkController");

const router = express.Router();

router.post("/", createShortlink);

router.get("/", getShortlinks);

router.get("/:id", getShortlink);

router.put("/:id", updateShortlink);

router.delete("/:id", deleteShortlink);

module.exports = router;
