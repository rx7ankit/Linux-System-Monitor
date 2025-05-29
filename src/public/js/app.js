const statsContainer = document.getElementById("stats");
const aiContentContainer = document.getElementById("ai-content");
const refreshButton = document.getElementById("refresh-analysis");
const refreshProcessesButton = document.getElementById("refresh-processes");
const cpuChartCtx = document.getElementById("cpuChart").getContext("2d");
const ramChartCtx = document.getElementById("ramChart").getContext("2d");
const diskChartCtx = document.getElementById("diskChart").getContext("2d");

let cpuChart, ramChart, diskChart;
let cpuData = [];
let timeLabels = [];
let currentSystemData = null;

// Configure marked for better rendering
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false
    });
}

async function fetchStats() {
    try {
        const res = await fetch('/stats');
        const data = await res.json();
        
        currentSystemData = data;
        updateStats(data);
        updateCharts(data);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function fetchProcessInfo() {
    try {
        const res = await fetch('/processes');
        const data = await res.json();
        updateProcessInfo(data);
    } catch (error) {
        console.error('Error fetching process info:', error);
    }
}

function updateProcessInfo(data) {
    // Update process statistics
    document.getElementById('total-processes').textContent = data.processStats.total;
    document.getElementById('running-processes').textContent = data.processStats.running;
    document.getElementById('sleeping-processes').textContent = data.processStats.sleeping;
    document.getElementById('zombie-processes').textContent = data.processStats.zombie;

    // Update CPU processes table
    const cpuProcessesContainer = document.getElementById('cpu-processes');
    cpuProcessesContainer.innerHTML = generateProcessTable(data.topCpuProcesses);

    // Update Memory processes table
    const memoryProcessesContainer = document.getElementById('memory-processes');
    memoryProcessesContainer.innerHTML = generateProcessTable(data.topMemoryProcesses);
}

function generateProcessTable(processes) {
    if (!processes || processes.length === 0) {
        return '<div class="no-processes">No process data available</div>';
    }

    let tableHTML = `
        <div class="process-table-header">
            <span class="col-pid">PID</span>
            <span class="col-user">USER</span>
            <span class="col-cpu">CPU%</span>
            <span class="col-mem">MEM%</span>
            <span class="col-command">COMMAND</span>
        </div>
    `;

    processes.forEach(process => {
        const commandShort = process.command.length > 30 
            ? process.command.substring(0, 30) + '...' 
            : process.command;
            
        tableHTML += `
            <div class="process-row">
                <span class="col-pid">${process.pid}</span>
                <span class="col-user">${process.user}</span>
                <span class="col-cpu">${process.cpu.toFixed(1)}%</span>
                <span class="col-mem">${process.memory.toFixed(1)}%</span>
                <span class="col-command" title="${process.command}">${commandShort}</span>
            </div>
        `;
    });

    return tableHTML;
}

async function fetchAIAnalysis() {
    if (!currentSystemData) {
        await fetchStats();
    }

    try {
        aiContentContainer.innerHTML = `
            <div class="ai-loading">
                <div class="ai-spinner"></div>
                Analyzing system performance with AI...
            </div>
        `;
        
        refreshButton.disabled = true;
        refreshButton.textContent = '🔄 Analyzing...';

        const response = await fetch('/ai-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentSystemData)
        });

        const result = await response.json();

        if (response.ok) {
            // Parse markdown and render as HTML
            let analysisHTML;
            
            if (typeof marked !== 'undefined') {
                // Use marked to parse markdown
                analysisHTML = marked.parse(result.analysis);
            } else {
                // Fallback: simple markdown-like formatting
                analysisHTML = result.analysis
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`(.*?)`/g, '<code>$1</code>')
                    .replace(/#{4}\s+(.*)/g, '<h4>$1</h4>')
                    .replace(/#{3}\s+(.*)/g, '<h3>$1</h3>')
                    .replace(/#{2}\s+(.*)/g, '<h2>$1</h2>')
                    .replace(/#{1}\s+(.*)/g, '<h1>$1</h1>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n- (.*)/g, '<li>$1</li>')
                    .replace(/\n\d+\.\s+(.*)/g, '<li>$1</li>');
                
                // Wrap in paragraphs
                if (!analysisHTML.includes('<p>')) {
                    analysisHTML = '<p>' + analysisHTML + '</p>';
                }
            }
            
            aiContentContainer.innerHTML = `
                <div class="markdown-analysis">
                    ${analysisHTML}
                </div>
                <div class="analysis-timestamp">
                    🕒 Last updated: ${new Date(result.timestamp).toLocaleString()}
                </div>
            `;
        } else {
            aiContentContainer.innerHTML = `
                <div style="color: #ff6b6b; text-align: center;">
                    <strong>⚠️ ${result.error}</strong>
                    <br><br>
                    <small>Make sure you have set your GEMINI_API_KEY in the environment variables.</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching AI analysis:', error);
        aiContentContainer.innerHTML = `
            <div style="color: #ff6b6b; text-align: center;">
                <strong>❌ Failed to get AI analysis</strong>
                <br><br>
                <small>Please check your internet connection and API configuration.</small>
            </div>
        `;
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = '🧠 Get AI Analysis';
    }
}

function updateStats(data) {
    const uptime = formatUptime(data.uptime);
    const memUsagePercent = ((data.totalMem - data.freeMem) / data.totalMem * 100).toFixed(1);
    
    statsContainer.innerHTML = `
        <div class="stats-overview">
            <div class="overview-card">
                <div class="overview-icon">🖥️</div>
                <div class="overview-content">
                    <h4>System Status</h4>
                    <p>Running smoothly</p>
                </div>
            </div>
            <div class="overview-card">
                <div class="overview-icon">⏱️</div>
                <div class="overview-content">
                    <h4>Uptime</h4>
                    <p>${uptime}</p>
                </div>
            </div>
            <div class="overview-card">
                <div class="overview-icon">💾</div>
                <div class="overview-content">
                    <h4>Memory Usage</h4>
                    <p>${memUsagePercent}%</p>
                </div>
            </div>
            <div class="overview-card">
                <div class="overview-icon">📊</div>
                <div class="overview-content">
                    <h4>Running Processes</h4>
                    <p>${data.processCount}</p>
                </div>
            </div>
        </div>
        <div class="detailed-stats">
            <div class="stat-row">
                <span class="stat-label">CPU Load Average:</span> 
                <span class="stat-value">${data.cpuLoad.map(x => x.toFixed(2)).join(", ")}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Total Memory:</span> 
                <span class="stat-value">${(data.totalMem / 1e9).toFixed(2)} GB</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Available Memory:</span> 
                <span class="stat-value">${(data.freeMem / 1e9).toFixed(2)} GB</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Used Memory:</span> 
                <span class="stat-value">${((data.totalMem - data.freeMem) / 1e9).toFixed(2)} GB</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Running Processes:</span> 
                <span class="stat-value">${data.processCount}</span>
            </div>
        </div>
    `;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function updateCharts(data) {
    updateCPUChart(data);
    updateRAMChart(data);
    updateDiskChart(data);
}

function updateCPUChart(data) {
    const currentTime = new Date().toLocaleTimeString();
    const avgLoad = data.cpuLoad.reduce((a, b) => a + b) / data.cpuLoad.length;
    
    if (cpuData.length > 20) {
        cpuData.shift();
        timeLabels.shift();
    }
    
    cpuData.push(avgLoad.toFixed(2));
    timeLabels.push(currentTime);

    if (!cpuChart) {
        cpuChart = new Chart(cpuChartCtx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'CPU Load Average',
                    data: cpuData,
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#FF6B6B',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff', maxTicksLimit: 6 },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    } else {
        cpuChart.data.labels = timeLabels;
        cpuChart.data.datasets[0].data = cpuData;
        cpuChart.update('none');
    }
}

function updateRAMChart(data) {
    const totalMem = data.totalMem / 1e9;
    const freeMem = data.freeMem / 1e9;
    const usedMem = totalMem - freeMem;
    const bufferMem = totalMem * 0.1;

    if (!ramChart) {
        ramChart = new Chart(ramChartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Used Memory', 'Buffer/Cache', 'Free Memory'],
                datasets: [{
                    data: [usedMem, bufferMem, freeMem - bufferMem],
                    backgroundColor: ['#4ECDC4', '#45B7D1', '#96CEB4'],
                    borderWidth: 0,
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            font: { size: 11 },
                            padding: 15
                        }
                    }
                },
                cutout: '60%'
            }
        });
    } else {
        ramChart.data.datasets[0].data = [usedMem, bufferMem, freeMem - bufferMem];
        ramChart.update('none');
    }
}

function updateDiskChart(data) {
    try {
        const diskLines = data.disk.trim().split('\n');
        const diskData = diskLines[1].split(/\s+/);
        
        const totalSize = diskData[1];
        const usedSize = diskData[2];
        const availSize = diskData[3];
        
        const totalGB = parseFloat(totalSize.replace('G', ''));
        const usedGB = parseFloat(usedSize.replace('G', ''));
        const availGB = parseFloat(availSize.replace('G', ''));

        if (!diskChart) {
            diskChart = new Chart(diskChartCtx, {
                type: 'bar',
                data: {
                    labels: ['Disk Usage'],
                    datasets: [
                        {
                            label: 'Used Space (GB)',
                            data: [usedGB],
                            backgroundColor: '#FFA726',
                            borderRadius: 8,
                            borderSkipped: false,
                        },
                        {
                            label: 'Available Space (GB)',
                            data: [availGB],
                            backgroundColor: '#66BB6A',
                            borderRadius: 8,
                            borderSkipped: false,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff',
                                font: { size: 11 }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            ticks: { color: '#fff' },
                            grid: { display: false }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            });
        } else {
            diskChart.data.datasets[0].data = [usedGB];
            diskChart.data.datasets[1].data = [availGB];
            diskChart.update('none');
        }
    } catch (error) {
        console.error('Error updating disk chart:', error);
    }
}

// Event listeners
refreshButton.addEventListener('click', fetchAIAnalysis);
refreshProcessesButton.addEventListener('click', fetchProcessInfo);

// Initialize and start fetching data
setInterval(fetchStats, 3000);
setInterval(fetchProcessInfo, 5000); // Update processes every 5 seconds
fetchStats();
fetchProcessInfo();

// Initial AI analysis after 2 seconds
setTimeout(fetchAIAnalysis, 2000);

// In the AI Analysis route, update the prompt:
const prompt = `
Analyze the following Linux system performance data and provide a comprehensive summary with recommendations in markdown format:

## System Overview
**CPU**: ${systemData.cpu.model}  
**Load Average**: ${loadAverage.join(', ')} (1m, 5m, 15m)  
**Memory**: ${systemData.memory.usagePercent} used of ${systemData.memory.total}  
**Disk**: ${systemData.disk.usagePercent} used of ${systemData.disk.total}  
**Processes**: ${systemData.system.processCount} running  
**Uptime**: ${systemData.system.uptime}  

## Top Resource Consumers
### CPU-intensive processes:
${processInfo.topCpu.map(proc => `- ${proc}`).join('\n')}

### Memory-intensive processes:
${processInfo.topMem.map(proc => `- ${proc}`).join('\n')}

Please provide a comprehensive analysis in markdown format including:

## System Health Assessment
Rate the overall system health (Good/Fair/Poor) and explain why.

## Performance Analysis
### CPU Performance
Analyze CPU load and usage patterns.

### Memory Performance  
Evaluate memory usage and potential issues.

### Disk Performance
Review storage usage and recommendations.

## Process Analysis
Identify any resource-heavy processes and potential issues.

## Recommendations
Provide specific optimization suggestions.

## Warnings & Alerts
List any critical issues or thresholds exceeded.

Use proper markdown formatting with headers, lists, bold text, and code blocks where appropriate.
`;