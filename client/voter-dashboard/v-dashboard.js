// Load voter info + status
async function loadVoterDashboard() {
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName') || 'Voter';

    const headerP = document.querySelector('.header-left p');
    if (headerP) {
        headerP.textContent = `Welcome, ${userName}`;
    }

    try {
        const infoSection = document.querySelector('.personal-info');
        if (infoSection) {
            infoSection.innerHTML = '<div class="loading"><span class="spinner"></span>Searching voter profile...</div>';
        }
        
        // Get voter profile
        const profileRes = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!profileRes.ok) {
            if (profileRes.status === 401 || profileRes.status === 403) {
                localStorage.removeItem('token');
                window.location.href = '../../login/login.html';
                return;
            }
            throw new Error(`Profile fetch failed: ${profileRes.status}`);
        }

        const profile = await profileRes.json();
        
        if (infoSection) {
            infoSection.innerHTML = '';
            const heading = document.createElement('h3');
            heading.textContent = 'Personal Information';
            infoSection.appendChild(heading);

            const fields = [
                { label: 'Name:', value: profile.name || 'N/A' },
                { label: 'Email:', value: profile.email || 'N/A' },
                { label: 'Voter ID:', value: profile._id ? profile._id.slice(-6) : 'N/A' },
                { 
                    label: 'Status:', 
                    customEl: () => {
                        const span = document.createElement('span');
                        span.className = `status ${profile.hasVoted ? 'voted' : 'pending'}`;
                        span.textContent = profile.hasVoted ? 'VOTED' : 'PENDING';
                        return span;
                    }
                }
            ];

            fields.forEach(f => {
                const item = document.createElement('div');
                item.className = 'list-item';
                const info = document.createElement('div');
                info.className = 'list-info';

                const strong = document.createElement('strong');
                strong.textContent = f.label + ' ';
                info.appendChild(strong);

                if (f.customEl) {
                    info.appendChild(f.customEl());
                } else {
                    const text = document.createTextNode(f.value);
                    info.appendChild(text);
                }

                item.appendChild(info);
                infoSection.appendChild(item);
            });
        }

        // Vote status card
        const voteStatus = document.querySelector('.stat-card');
        if (voteStatus) {
            const valEl = voteStatus.querySelector('.value');
            if (valEl) valEl.textContent = profile.hasVoted ? 'VOTED' : 'PENDING';

            const lblEl = voteStatus.querySelector('.label');
            if (lblEl) lblEl.textContent = profile.hasVoted ? 'Vote Submitted' : 'Ready to Vote';

            const iconEl = voteStatus.querySelector('.icon-box i');
            if (iconEl) {
                iconEl.className = profile.hasVoted ? 'fas fa-check-circle green' : 'fas fa-clock orange';
            }
        }

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

loadVoterDashboard();
