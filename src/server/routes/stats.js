const express = require("express");
const { getSystemInfo } = require("../utils/systemInfo");

const router = express.Router();

router.get("/stats", (req, res) => {
    const systemStats = getSystemInfo();
    res.json(systemStats);
});

module.exports = router;