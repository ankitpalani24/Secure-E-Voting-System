let data = {
    votersCount: 0,
    votesCount: 0,
    partiesCount: 0
};

// Load live stats from API
async function loadDashboardData() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const statsSection = document.querySelector('.stats-grid') || document.body;
    // The loading text wipe has been removed to preserve the stat-card HTML elements
    
    try {
        const res = await fetch('http://localhost:5000/api/admin/stats', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = '../../login/login.html';
                return;
            }
            throw new Error(`API returned ${res.status}`);
        }

        const stats = await res.json();
        data = stats;
        animateCounters();
    } catch (e) {
        statsSection.innerHTML = `<div style="text-align:center; padding: 20px;">
            <h3 style="color: red;">Error Loading Stats</h3>
            <p>${e.message}</p>
            <p>If the error is "Failed to fetch", please try a <strong>hard refresh (Ctrl + F5)</strong>. Your browser might still be using the cached older file!</p>
        </div>`;
        console.error('Dashboard stats error:', e);
    }
}

// Animate counters
function animateCounters() {
    const values = document.querySelectorAll('.stat-card .value');
    const labels = ['votersCount', 'votesCount', 'partiesCount'];
    
    values.forEach((value, index) => {
        const target = data[labels[index]];
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                value.textContent = target;
                clearInterval(timer);
            } else {
                value.textContent = Math.floor(current);
            }
        }, 20);
    });
    
    // Update System Overview List
    const listCounts = document.querySelectorAll('.overview-list .list-count');
    if (listCounts.length >= 3) {
        listCounts[0].textContent = data.votersCount || 0;
        listCounts[1].textContent = data.votesCount || 0;
        listCounts[2].textContent = Math.max(0, (data.votersCount || 0) - (data.votesCount || 0));
    }
    
    updateNavCounts();
}

// Update nav counts
function updateNavCounts() {
    const voterTab = document.querySelector('a[href*="/voters/"]');
    if (voterTab) voterTab.innerHTML = '<i class="fas fa-users"></i> Voters (' + data.votersCount + ')';
    
    const partyTab = document.querySelector('a[href*="/parties/"]');
    if (partyTab) partyTab.innerHTML = '<i class="fas fa-building"></i> Parties (' + data.partiesCount + ')';
}

// Hover effects
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll(".stat-card");
    cards.forEach(card => {
        card.addEventListener("mouseenter", () => {
            card.style.transform = "scale(1.05)";
        });
        card.addEventListener("mouseleave", () => {
            card.style.transform = "scale(1)";
        });
    });
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

// Initialize
loadDashboardData();

