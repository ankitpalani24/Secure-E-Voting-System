let partyDoughnutInstance = null;
let partyBarInstance = null;

function renderPartyCharts(parties, voteCounts) {
    const doughnutCtx = document.getElementById('partyDoughnutChart');
    const barCtx = document.getElementById('partyBarChart');
    if (!doughnutCtx || !barCtx || !window.Chart) return;

    const palette = [
        '#2563EB', '#16A34A', '#D97706', '#7E22CE', '#0284C7',
        '#DC2626', '#EA580C', '#4F46E5', '#0D9488', '#E11D48'
    ];

    const labels = parties.map(p => `${p.partyName} (${p.symbol || '🗳️'})`);
    const data = voteCounts;
    const colors = labels.map((_, i) => palette[i % palette.length]);

    if (partyDoughnutInstance) partyDoughnutInstance.destroy();
    if (partyBarInstance) partyBarInstance.destroy();

    partyDoughnutInstance = new Chart(doughnutCtx, {
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

    partyBarInstance = new Chart(barCtx, {
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
                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Inter' } }, grid: { color: '#F1F5F9' } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Load election results for party
async function loadPartyResults() {
    const token = localStorage.getItem('token');
    
    try {
        const userName = localStorage.getItem('userName') || 'Party Representative';
        const headerP = document.querySelector('.header-left p');
        if (headerP) headerP.textContent = `Welcome, ${userName}`;

        const res = await fetch('/api/results', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const results = await res.json();

        // Update Nav Tab for Parties Count
        try {
            const partiesRes = await fetch('/api/party', { headers: { Authorization: `Bearer ${token}` } });
            if (partiesRes.ok) {
                const partiesData = await partiesRes.json();
                const partyTab = document.querySelector('a[href*="/p-parties.html"]');
                if (partyTab) partyTab.innerHTML = `<i class="fas fa-building"></i> Registered Parties (${partiesData.length || 0})`;
            }
        } catch (e) {
            console.error('Party tab count error:', e);
        }

        const partyList = document.querySelector('.party-list');
        partyList.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = 'Certified Election Tally :';
        partyList.appendChild(heading);

        if (!Array.isArray(results) || results.length === 0) {
            const noResults = document.createElement('p');
            noResults.textContent = 'No election results recorded yet.';
            partyList.appendChild(noResults);
            const chartsSec = document.getElementById('chartsSection');
            if (chartsSec) chartsSec.style.display = 'none';
            return;
        }

        // Sort results by total votes descending
        const sortedResults = results.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
        const totalVotesCount = sortedResults.reduce((sum, p) => sum + (p.totalVotes || 0), 0);

        const totalBadge = document.getElementById('partyTotalBadge');
        if (totalBadge) totalBadge.textContent = `${totalVotesCount} Ballots Cast`;

        const chartsSec = document.getElementById('chartsSection');
        if (chartsSec) chartsSec.style.display = 'grid';
        renderPartyCharts(sortedResults, sortedResults.map(p => p.totalVotes || 0));

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

            const textDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = `${party.partyName || 'Unknown'} (${party.symbol || 'N/A'}) `;

            const badge = document.createElement('strong');
            badge.style.cssText = 'color: var(--primary); background: var(--primary-light); padding: 3px 10px; border-radius: 12px; font-size: 0.8em; margin-left: 8px; font-weight: 600;';
            badge.textContent = rankBadge;
            labelSpan.appendChild(badge);

            const valueH2 = document.createElement('h2');
            valueH2.className = 'value';
            valueH2.textContent = `${party.totalVotes || 0} Votes (${percentage}%)`;

            textDiv.appendChild(labelSpan);
            textDiv.appendChild(valueH2);

            const iconBox = document.createElement('div');
            iconBox.className = rank === 1 ? 'icon-box green' : 'icon-box purple';
            const icon = document.createElement('i');
            icon.className = rank === 1 ? 'fas fa-trophy' : 'fas fa-landmark';
            iconBox.appendChild(icon);

            card.appendChild(textDiv);
            card.appendChild(iconBox);
            partyList.appendChild(card);
        });
    } catch (err) {
        console.error('Party Results error:', err);
    }
}

loadPartyResults();