// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Load Voter Profile & Participation Status
async function loadVoterDashboard() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../login/login.html';

    const cachedName = localStorage.getItem('userName') || 'Citizen';
    const welcomeHeader = document.getElementById('voterWelcomeHeader');
    const profileName = document.getElementById('voterProfileName');
    const voterName = document.getElementById('voterName');
    const voterEmail = document.getElementById('voterEmail');

    if (welcomeHeader) welcomeHeader.textContent = `Welcome, ${cachedName}`;
    if (profileName) profileName.textContent = cachedName;
    if (voterName) voterName.textContent = cachedName;
    if (voterEmail) voterEmail.textContent = localStorage.getItem('userEmail') || 'citizen@domain.com';

    try {
        const res = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            const profile = await res.json();

            if (voterName) voterName.textContent = profile.name || cachedName;
            if (voterEmail) voterEmail.textContent = profile.email || 'citizen@domain.com';
            if (profileName) profileName.textContent = profile.name || cachedName;

            const badge = document.getElementById('voterHasVotedBadge');
            const checkIcon = document.getElementById('ballotStatusCheckIcon');
            const checkTitle = document.getElementById('ballotStatusCheckTitle');
            const checkSub = document.getElementById('ballotStatusCheckSub');
            const heroBtn = document.getElementById('castVoteHeroBtn');

            if (profile.hasVoted) {
                if (badge) {
                    badge.className = 'status-badge live';
                    badge.textContent = '✓ Ballot Recorded';
                }
                if (checkIcon) {
                    checkIcon.className = 'fas fa-check-circle';
                    checkIcon.style.color = 'var(--success)';
                }
                if (checkTitle) checkTitle.textContent = 'Ballot Status: Recorded & Sealed';
                if (checkSub) checkSub.textContent = 'Your anonymous vote is securely committed in the tally box';
                if (heroBtn) {
                    heroBtn.innerHTML = '<i class="fas fa-poll"></i> View Live Results &rarr;';
                    heroBtn.href = 'v-result.html';
                    heroBtn.style.backgroundColor = '#1D4ED8';
                }
            } else {
                if (badge) {
                    badge.className = 'status-badge pending';
                    badge.textContent = 'Ready to Vote';
                }
            }
        }
    } catch (err) {
        console.error('Voter profile load error:', err);
    }
}

loadVoterDashboard();
