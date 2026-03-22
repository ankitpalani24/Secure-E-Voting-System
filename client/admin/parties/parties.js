// Load parties list from API
async function loadParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../../login/login.html';

        const statsGrid = document.querySelector('.stats-grid');
        statsGrid.innerHTML = '<div class="loading"><span class="spinner"></span>Searching parties...</div>';
        
        try {
            const res = await fetch('http://localhost:5000/api/admin/parties', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const parties = await res.json();
        statsGrid.innerHTML = '';

        parties.forEach((party, index) => {
            const colors = ['green', 'blue', 'orange', 'purple'];
            const color = colors[index % colors.length];
            
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.backgroundColor = `hsla(${index * 60}, 100%, 75%, 0.5)`;
            card.innerHTML = `
                <div>
                    <span class="label">${party.partyName}</span>
                    <h2 class="value">${party.symbol}</h2>
                </div>
                <div class="icon-box ${color}"><i class="fas fa-building"></i></div>
            `;
            statsGrid.appendChild(card);
        });

        // Fetch global stats to update nav tabs
        try {
            const statsRes = await fetch('http://localhost:5000/api/admin/stats', { headers: { Authorization: `Bearer ${token}` }});
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
    } catch (err) {
        document.querySelector('.stats-grid').innerHTML = '<div class="stat-card"><h2>Error loading parties</h2></div>';
        console.error(err);
    }
}

// Hover effects
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

// Load parties
loadParties();

