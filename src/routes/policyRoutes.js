const express = require("express");

const {
    getPolicy,
    createOrUpdatePolicy,
    deletePolicy,
} = require("../controllers/policyController");

const router = express.Router();

router.get(
    "/:shortlinkId",
    getPolicy
);

router.put(
    "/:shortlinkId",
    createOrUpdatePolicy
);

router.delete(
    "/:shortlinkId",
    deletePolicy
);

module.exports = router;
