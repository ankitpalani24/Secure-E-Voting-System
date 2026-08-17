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
        partyList.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = 'Results :';
        partyList.appendChild(heading);

        if (!Array.isArray(results) || results.length === 0) {
            const noResults = document.createElement('p');
            noResults.textContent = 'No election results recorded yet.';
            partyList.appendChild(noResults);
            return;
        }

        // Sort results by total votes descending
        const sortedResults = results.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));

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

            const textDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = `${party.partyName || 'Unknown'} (${party.symbol || 'N/A'}) `;

            const badge = document.createElement('strong');
            badge.style.cssText = 'color:#333; background:#eee; padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:8px;';
            badge.textContent = rankBadge;
            labelSpan.appendChild(badge);

            const valueH2 = document.createElement('h2');
            valueH2.className = 'value';
            valueH2.textContent = `${party.totalVotes || 0} Votes`;

            textDiv.appendChild(labelSpan);
            textDiv.appendChild(valueH2);

            const iconBox = document.createElement('div');
            iconBox.className = `icon-box ${colors[colorIndex]}`;
            const icon = document.createElement('i');
            icon.className = 'fas fa-users';
            iconBox.appendChild(icon);

            card.appendChild(textDiv);
            card.appendChild(iconBox);
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
if (logoutBtn) {
    logoutBtn.addEventListener("mouseover", () => {
        logoutBtn.style.color = "#ff0000";
        logoutBtn.style.transform = "scale(1.2)";
    });
    logoutBtn.addEventListener("mouseout", () => {
        logoutBtn.style.color = "inherit";
        logoutBtn.style.transform = "scale(1)";
    });
}

loadResults();

// ================== REAL-TIME WEBSOCKETS ==================
const socket = window.io ? window.io(window.location.origin) : null;

if (socket) {
    socket.on('newVote', () => {
        // We re-fetch to ensure rankings are correctly re-sorted without leaking IDs
        loadResults();
    });
}
