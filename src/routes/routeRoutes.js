const express = require("express");

const {
    createRoute,
    getRoutes,
    getRoute,
    updateRoute,
    deleteRoute,
} = require("../controllers/routeController");

const router = express.Router();

router.post("/", createRoute);

router.get("/", getRoutes);

router.get("/:id", getRoute);

router.put("/:id", updateRoute);

router.delete("/:id", deleteRoute);

module.exports = router;
