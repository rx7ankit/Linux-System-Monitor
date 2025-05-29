const ctxCPU = document.getElementById('cpuChart').getContext('2d');
const ctxRAM = document.getElementById('ramChart').getContext('2d');
const ctxDisk = document.getElementById('diskChart').getContext('2d');

let cpuChart, ramChart, diskChart;

function createCharts() {
    cpuChart = new Chart(ctxCPU, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU Load',
                data: [],
                borderColor: 'rgba(0, 255, 136, 1)',
                backgroundColor: 'rgba(0, 255, 136, 0.2)',
                borderWidth: 2,
                fill: true,
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom'
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    ramChart = new Chart(ctxRAM, {
        type: 'doughnut',
        data: {
            labels: ['Used Memory', 'Free Memory'],
            datasets: [{
                data: [],
                backgroundColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
            }
        }
    });

    diskChart = new Chart(ctxDisk, {
        type: 'bar',
        data: {
            labels: ['Used Disk', 'Free Disk'],
            datasets: [{
                label: 'Disk Usage',
                data: [],
                backgroundColor: 'rgba(255, 206, 86, 1)',
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateCharts(data) {
    const cpuLoad = data.cpuLoad.map(x => x.toFixed(2));
    const totalMem = data.totalMem / 1e9;
    const freeMem = data.freeMem / 1e9;
    const usedMem = totalMem - freeMem;

    cpuChart.data.labels.push(cpuLoad.length);
    cpuChart.data.datasets[0].data.push(cpuLoad[cpuLoad.length - 1]);
    cpuChart.update();

    ramChart.data.datasets[0].data = [usedMem, freeMem];
    ramChart.update();

    const totalDisk = data.disk.split('\n')[1].split(/\s+/);
    const usedDisk = totalDisk[2];
    const freeDisk = totalDisk[3];

    diskChart.data.datasets[0].data = [usedDisk, freeDisk];
    diskChart.update();
}

document.addEventListener('DOMContentLoaded', () => {
    createCharts();
    setInterval(async () => {
        const res = await fetch('/stats');
        const data = await res.json();
        updateCharts(data);
    }, 3000);
});