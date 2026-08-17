// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

let doughnutChartInstance = null;
let barChartInstance = null;

// Initialize & render Chart.js analytics
function renderAnalyticsCharts(parties, voteCounts) {
    const doughnutCtx = document.getElementById('voteDoughnutChart');
    const barCtx = document.getElementById('voteBarChart');
    if (!doughnutCtx || !barCtx || !window.Chart) return;

    const palette = [
        '#667A3E', '#4F612F', '#8A9B5A', '#2F7D32', '#C58A00',
        '#2E6B8E', '#7E22CE', '#C0392B', '#556B2F', '#3B7A57'
    ];

    const labels = parties.map(p => `${p.partyName} (${p.symbol || '🗳️'})`);
    const data = voteCounts;
    const colors = labels.map((_, i) => palette[i % palette.length]);

    if (doughnutChartInstance) doughnutChartInstance.destroy();
    if (barChartInstance) barChartInstance.destroy();

    doughnutChartInstance = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.raw || 0;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${val} Votes (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });

    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: parties.map(p => p.partyName),
            datasets: [{
                label: 'Votes Cast',
                data,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Inter' } }, grid: { color: '#EEF0E8' } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Load results from API
async function loadResults() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    try {
        const res = await fetch('/api/results', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const results = await res.json();

        const container = document.getElementById('resultsListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!Array.isArray(results) || results.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No certified results recorded in the ballot box yet.</p>';
            const chartsSec = document.getElementById('chartsSection');
            if (chartsSec) chartsSec.style.display = 'none';
            return;
        }

        const sortedResults = results.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
        const totalVotesCount = sortedResults.reduce((sum, p) => sum + (p.totalVotes || 0), 0);

        const totalBadge = document.getElementById('totalVotesBadge');
        if (totalBadge) totalBadge.textContent = `${totalVotesCount.toLocaleString()} Total Ballots`;

        const chartsSec = document.getElementById('chartsSection');
        if (chartsSec) chartsSec.style.display = 'grid';
        renderAnalyticsCharts(sortedResults, sortedResults.map(p => p.totalVotes || 0));

        sortedResults.forEach((party, index) => {
            const rank = index + 1;
            let rankBadge = '';
            if (rank === 1) rankBadge = '🥇 1st Place (Leading)';
            else if (rank === 2) rankBadge = '🥈 2nd Place';
            else if (rank === 3) rankBadge = '🥉 3rd Place';
            else rankBadge = `${rank}th Place`;

            const percentage = totalVotesCount > 0 ? (((party.totalVotes || 0) / totalVotesCount) * 100).toFixed(1) : 0;

            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.marginBottom = '12px';

            const textDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = `${party.partyName || 'Unknown'} (${party.symbol || 'N/A'}) `;

            const badge = document.createElement('strong');
            badge.style.cssText = 'color: var(--primary-dark); background: var(--primary-subtle); padding: 3px 10px; border-radius: 12px; font-size: 0.8em; margin-left: 8px; font-weight: 600;';
            badge.textContent = rankBadge;
            labelSpan.appendChild(badge);

            const valueH2 = document.createElement('h2');
            valueH2.className = 'value';
            valueH2.textContent = `${(party.totalVotes || 0).toLocaleString()} Votes (${percentage}%)`;

            textDiv.appendChild(labelSpan);
            textDiv.appendChild(valueH2);

            const iconBox = document.createElement('div');
            iconBox.className = rank === 1 ? 'icon-box green' : 'icon-box purple';
            const icon = document.createElement('i');
            icon.className = rank === 1 ? 'fas fa-trophy' : 'fas fa-landmark';
            iconBox.appendChild(icon);

            card.appendChild(textDiv);
            card.appendChild(iconBox);
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Results error:', err);
    }
}

// WebSocket real-time tally refresh
const socket = window.io ? window.io(window.location.origin) : null;
if (socket) {
    socket.on('newVote', () => {
        loadResults();
    });
}

loadResults();
