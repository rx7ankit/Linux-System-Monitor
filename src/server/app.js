require('dotenv').config();

const express = require("express");
const path = require("path");
const { execSync } = require("child_process");
const { getSystemInfo, formatMemoryUsage, getDiskUsage } = require("./utils/systemInfo");

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json());

// Get system stats route
app.get("/stats", (req, res) => {
    try {
        const systemStats = getSystemInfo();
        const totalMem = systemStats.totalMem;
        const freeMem = systemStats.freeMem;
        const memoryInfo = formatMemoryUsage(totalMem, freeMem);
        const diskInfo = getDiskUsage();
        
        // Get process count
        const processCount = execSync("ps aux | wc -l").toString().trim();
        
        res.json({
            ...systemStats,
            memory: memoryInfo,
            diskUsage: diskInfo,
            processCount: parseInt(processCount) - 1 // Subtract header line
        });
    } catch (error) {
        console.error("Error fetching system stats:", error);
        res.status(500).json({ error: "Failed to fetch system stats" });
    }
});

// Get detailed process information
app.get("/processes", (req, res) => {
    try {
        // Get top processes by CPU usage
        const topCpuProcesses = execSync("ps aux --sort=-%cpu | head -11").toString().trim().split('\n');
        
        // Get top processes by memory usage
        const topMemProcesses = execSync("ps aux --sort=-%mem | head -11").toString().trim().split('\n');
        
        // Parse process information
        const parseProcesses = (processLines) => {
            const processes = [];
            for (let i = 1; i < processLines.length; i++) { // Skip header
                const fields = processLines[i].trim().split(/\s+/);
                if (fields.length >= 11) {
                    processes.push({
                        user: fields[0],
                        pid: fields[1],
                        cpu: parseFloat(fields[2]),
                        memory: parseFloat(fields[3]),
                        vsz: fields[4],
                        rss: fields[5],
                        tty: fields[6],
                        stat: fields[7],
                        start: fields[8],
                        time: fields[9],
                        command: fields.slice(10).join(' ')
                    });
                }
            }
            return processes;
        };

        const topCpu = parseProcesses(topCpuProcesses);
        const topMem = parseProcesses(topMemProcesses);

        // Get system load and other process stats
        const totalProcesses = execSync("ps aux | wc -l").toString().trim();
        const runningProcesses = execSync("ps aux | awk '$8 ~ /^R/ {count++} END {print count+0}'").toString().trim();
        const sleepingProcesses = execSync("ps aux | awk '$8 ~ /^S/ {count++} END {print count+0}'").toString().trim();
        const zombieProcesses = execSync("ps aux | awk '$8 ~ /^Z/ {count++} END {print count+0}'").toString().trim();

        res.json({
            topCpuProcesses: topCpu,
            topMemoryProcesses: topMem,
            processStats: {
                total: parseInt(totalProcesses) - 1,
                running: parseInt(runningProcesses),
                sleeping: parseInt(sleepingProcesses),
                zombie: parseInt(zombieProcesses)
            }
        });
    } catch (error) {
        console.error("Error fetching process information:", error);
        res.status(500).json({ error: "Failed to fetch process information" });
    }
});

// AI Analysis route
app.post("/ai-analysis", async (req, res) => {
    try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        
        // Check if API key is provided
        console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Found" : "Not found");
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({ 
                error: "Gemini API key not found. Please set GEMINI_API_KEY in your environment variables." 
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Get comprehensive system data
        const systemStats = getSystemInfo();
        const memoryInfo = formatMemoryUsage(systemStats.totalMem, systemStats.freeMem);
        const diskInfo = getDiskUsage();
        const processCount = execSync("ps aux | wc -l").toString().trim();
        
        // Get process information
        const processInfo = await new Promise((resolve, reject) => {
            try {
                const topCpuProcesses = execSync("ps aux --sort=-%cpu | head -6").toString().trim().split('\n');
                const topMemProcesses = execSync("ps aux --sort=-%mem | head -6").toString().trim().split('\n');
                
                resolve({
                    topCpu: topCpuProcesses.slice(1).map(line => {
                        const fields = line.trim().split(/\s+/);
                        return `${fields[10]} (CPU: ${fields[2]}%, MEM: ${fields[3]}%)`;
                    }),
                    topMem: topMemProcesses.slice(1).map(line => {
                        const fields = line.trim().split(/\s+/);
                        return `${fields[10]} (CPU: ${fields[2]}%, MEM: ${fields[3]}%)`;
                    })
                });
            } catch (error) {
                resolve({ topCpu: [], topMem: [] });
            }
        });
        
        // Get additional system information
        let cpuInfo;
        try {
            cpuInfo = execSync("lscpu | grep 'Model name' | cut -d':' -f2").toString().trim();
        } catch (error) {
            cpuInfo = "Unknown CPU";
        }
        
        const memUsagePercent = ((systemStats.totalMem - systemStats.freeMem) / systemStats.totalMem * 100).toFixed(1);
        const diskUsagePercent = diskInfo.usePercentage;
        const loadAverage = systemStats.cpuLoad;
        
        // Prepare data for AI analysis
        const systemData = {
            cpu: {
                model: cpuInfo,
                loadAverage: loadAverage,
                cores: systemStats.cpuLoad.length
            },
            memory: {
                total: memoryInfo.total + " GB",
                used: memoryInfo.used + " GB",
                free: memoryInfo.free + " GB",
                usagePercent: memUsagePercent + "%"
            },
            disk: {
                total: diskInfo.size,
                used: diskInfo.used,
                available: diskInfo.available,
                usagePercent: diskUsagePercent
            },
            system: {
                uptime: Math.floor(systemStats.uptime / 3600) + " hours",
                processCount: parseInt(processCount) - 1
            },
            processes: processInfo
        };

        const prompt = `
        Analyze the following Linux system performance data and provide a comprehensive summary with recommendations:

        CPU Information:
        - Model: ${systemData.cpu.model}
        - Load Average (1m, 5m, 15m): ${loadAverage.join(', ')}
        - CPU Cores: ${systemData.cpu.cores}

        Memory Usage:
        - Total RAM: ${systemData.memory.total}
        - Used RAM: ${systemData.memory.used}
        - Free RAM: ${systemData.memory.free}
        - Usage Percentage: ${systemData.memory.usagePercent}

        Disk Usage:
        - Total Storage: ${systemData.disk.total}
        - Used Storage: ${systemData.disk.used}
        - Available Storage: ${systemData.disk.available}
        - Usage Percentage: ${systemData.disk.usagePercent}

        System Information:
        - Uptime: ${systemData.system.uptime}
        - Running Processes: ${systemData.system.processCount}

        Top CPU-consuming processes:
        ${processInfo.topCpu.join('\n')}

        Top Memory-consuming processes:
        ${processInfo.topMem.join('\n')}

        Please provide:
        1. Overall system health assessment (Good/Fair/Poor)
        2. Performance analysis for CPU, Memory, and Disk
        3. Analysis of top processes and potential resource hogs
        4. Potential bottlenecks or issues
        5. Specific recommendations for optimization
        6. Any warnings or alerts if thresholds are exceeded

        Keep the response concise but informative, suitable for a system administrator.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysis = response.text();

        res.json({ 
            analysis: analysis,
            timestamp: new Date().toISOString(),
            systemData: systemData
        });

    } catch (error) {
        console.error("Error generating AI analysis:", error);
        
        // Provide more specific error information
        let errorMessage = "Failed to generate AI analysis.";
        if (error.message.includes("404")) {
            errorMessage = "Model not found. The Gemini model may have been updated.";
        } else if (error.message.includes("403")) {
            errorMessage = "API key authentication failed. Please check your API key.";
        } else if (error.message.includes("quota")) {
            errorMessage = "API quota exceeded. Please try again later.";
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});