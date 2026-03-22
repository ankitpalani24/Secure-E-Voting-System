// Load all parties for party dashboard
async function loadPartyParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../../login/login.html';

        const statsGrid = document.querySelector('.stats-grid');
        statsGrid.innerHTML = '<div class="loading"><span class="spinner"></span>Searching parties...</div>';
        
        try {
            const res = await fetch('http://localhost:5000/api/party', {
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
                <div class="icon-box ${color}"><i class="fas fa-flag-checkered"></i></div>
            `;
            statsGrid.appendChild(card);
        });

        // Update nav
        const nav = document.querySelector('a[href*="/p-parties.html"]');
        if (nav) nav.innerHTML = `<i class="fas fa-building"></i> Parties (${parties.length})`;
    } catch (err) {
        console.error(err);
    }
}

loadPartyParties();

// Hover logout
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
