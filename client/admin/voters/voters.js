// Global variables for search filtering
let allVoters = [];

// Load voters from API
async function loadVoters() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const container = document.querySelector('.overview-list');
    container.innerHTML = '<div class="loading"><span class="spinner"></span>Searching voters...</div>';
    
    try {
        const res = await fetch('/api/admin/voters', {
            headers: { Authorization: `Bearer ${token}` }
        });
        allVoters = await res.json(); // Persist all loaded voters

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

        // Display all voters initially
        displayVoters(allVoters);

    } catch (err) {
        document.querySelector('.overview-list').innerHTML = '<h3>Error loading voters</h3>';
        console.error(err);
    }
}

// Render voters array into the DOM
function displayVoters(votersArray) {
    const container = document.querySelector('.overview-list');
    container.innerHTML = '<h3>Voters List (' + votersArray.length + ')</h3>';

    if (votersArray.length === 0) {
        container.innerHTML += '<p>No voters found.</p>';
        return;
    }

    votersArray.forEach(voter => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="list-info">
                <strong>${voter.name}</strong>
                <p>${voter.email} | ID: ${voter._id.slice(-6)} | Voted: ${voter.hasVoted ? 'Yes' : 'No'}</p>
            </div>
            <span class="list-count ${voter.hasVoted ? 'green-text' : 'orange-text'}">${voter.hasVoted ? 'VOTED' : 'PENDING'}</span>
        `;
        container.appendChild(item);
    });
}

// Search bar listener (filtering precisely by full name)
const searchInput = document.getElementById('voterSearch');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredVoters = allVoters.filter(voter => 
            voter.name.toLowerCase().includes(searchTerm)
        );
        displayVoters(filteredVoters);
    });
}

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

// Load on page ready
loadVoters();
