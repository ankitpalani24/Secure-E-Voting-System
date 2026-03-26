// Load election results for admin
async function loadResults() {
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch('/api/results', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const results = await res.json();

        // Fetch global stats to update nav tabs
        try {
            const statsRes = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` }});
            if (statsRes.ok) {
                const stats = await statsRes.json();
                const voterTab = document.querySelector('a[href*="/voters/"]');
                if (voterTab) voterTab.innerHTML = '<i class="fas fa-users"></i> Voters (' + stats.votersCount + ')';
                const partyTab = document.querySelector('a[href*="/parties/"]');
                if (partyTab) partyTab.innerHTML = '<i class="fas fa-building"></i> Parties (' + stats.partiesCount + ')';
            }
        } catch (e) {
            console.error('Nav stats load error:', e);
        }

        const partyList = document.querySelector('.party-list');
        partyList.innerHTML = '<h3>Results :</h3>';

        // Sort results by total votes descending
        const sortedResults = results.sort((a, b) => b.totalVotes - a.totalVotes);

        const colors = ['green', 'blue', 'orange', 'purple'];
        const bgs = ['hsla(93, 100%, 75%, 0.5)', 'hsla(220, 100%, 75%, 0.5)', 'hsla(51, 100%, 75%, 0.5)', 'hsla(293, 100%, 75%, 0.5)'];

        sortedResults.forEach((party, index) => {
            const rank = index + 1;
            let rankBadge = '';
            if (rank === 1) rankBadge = '🥇 1st Rank';
            else if (rank === 2) rankBadge = '🥈 2nd Rank';
            else if (rank === 3) rankBadge = '🥉 3rd Rank';
            else rankBadge = `${rank}th Rank`;

            const colorIndex = index % colors.length;

            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.backgroundColor = bgs[colorIndex];
            card.innerHTML = `
                <div>
                    <span class="label">${party.partyName} (${party.symbol}) <strong style="color:#333; background:#eee; padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:8px;">${rankBadge}</strong></span>
                    <h2 class="value">${party.totalVotes} Votes</h2>
                </div>
                <div class="icon-box ${colors[colorIndex]}"><i class="fas fa-users"></i></div>
            `;
            partyList.appendChild(card);
        });
    } catch (err) {
        console.error('Results error:', err);
    }
}

document.querySelectorAll('.stat-card').forEach(card => {
    card.onmouseover = function() {
        this.style.backgroundColor = 'rgba(44, 44, 44, 0.18)';
    };
    card.onmouseout = function() {
        this.style.backgroundColor = '';
    };
});

const logoutBtn = document.querySelector(".logout-btn");
logoutBtn.addEventListener("mouseover", () => {
    logoutBtn.style.color = "#ff0000";
    logoutBtn.style.transform = "scale(1.2)";
});
logoutBtn.addEventListener("mouseout", () => {
    logoutBtn.style.color = "inherit";
    logoutBtn.style.transform = "scale(1)";
});
loadResults();

// ================== REAL-TIME WEBSOCKETS ==================
const socket = window.io ? window.io('http://localhost:5000') : null;

if (socket) {
    socket.on('newVote', (voteData) => {
        console.log('Real-time vote received! Updating admin result cards...', voteData);
        // We re-fetch to ensure rankings are correctly re-sorted.
        loadResults();
    });
}
