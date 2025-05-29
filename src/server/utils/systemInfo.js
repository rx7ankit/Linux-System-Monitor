const os = require("os");
const { execSync } = require("child_process");

function getSystemInfo() {
    return {
        cpuLoad: os.loadavg(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        uptime: os.uptime(),
        disk: execSync("df -h /").toString(),
    };
}

function formatMemoryUsage(totalMem, freeMem) {
    const usedMem = totalMem - freeMem;
    return {
        total: (totalMem / 1e9).toFixed(2),
        used: (usedMem / 1e9).toFixed(2),
        free: (freeMem / 1e9).toFixed(2),
    };
}

function getDiskUsage() {
    const diskInfo = execSync("df -h /").toString().split("\n")[1].split(/\s+/);
    return {
        filesystem: diskInfo[0],
        size: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usePercentage: diskInfo[4],
    };
}

module.exports = {
    getSystemInfo,
    formatMemoryUsage,
    getDiskUsage,
};