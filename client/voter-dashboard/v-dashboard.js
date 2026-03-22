// Load voter info + status
async function loadVoterDashboard() {
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName') || 'Voter';

    document.querySelector('.header-left p').textContent = `Welcome, ${userName}`;

    try {
        const infoSection = document.querySelector('.personal-info');
        infoSection.innerHTML = '<div class="loading"><span class="spinner"></span>Searching voter profile...</div>';
        
        // Get voter profile
        const profileRes = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const profile = await profileRes.json();
        
        infoSection.innerHTML = `
            <h3>Personal Information</h3>
            <div class="list-item">
                <div class="list-info">
                    <strong>Name:</strong> ${profile.name || 'N/A'}
                </div>
            </div>
            <div class="list-item">
                <div class="list-info">
                    <strong>Email:</strong> ${profile.email || 'N/A'}
                </div>
            </div>
            <div class="list-item">
                <div class="list-info">
                    <strong>Voter ID:</strong> ${profile._id ? profile._id.slice(-6) : 'N/A'}
                </div>
            </div>
            <div class="list-item">
                <div class="list-info">
                    <strong>Status:</strong> <span class="status ${profile.hasVoted ? 'voted' : 'pending'}">${profile.hasVoted ? 'VOTED' : 'PENDING'}</span>
                </div>
            </div>
        `;

        // Vote status card
        const voteStatus = document.querySelector('.stat-card');
        voteStatus.querySelector('.value').textContent = profile.hasVoted ? 'VOTED' : 'PENDING';
        voteStatus.querySelector('.label').textContent = profile.hasVoted ? 'Vote Submitted' : 'Ready to Vote';
        voteStatus.querySelector('.icon-box i').className = profile.hasVoted ? 'fas fa-check-circle green' : 'fas fa-clock orange';

    } catch (err) {
        console.error('Voter dashboard error:', err);
    }
}

document.querySelectorAll('.stat-card').forEach(card => {
    card.onmouseover = function () {
        this.style.backgroundColor = 'rgba(44, 44, 44, 0.18)';
    };
    card.onmouseout = function () {
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

loadVoterDashboard();


