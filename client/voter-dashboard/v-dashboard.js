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
            const electionBadge = document.getElementById('voterElectionStatusBadge');

            const election = profile.election || {};
            const phase = election.phase || 'VOTING';

            // Topbar Election Status Badge
            if (electionBadge) {
                if (phase === 'VOTING') {
                    electionBadge.className = 'status-badge live';
                    electionBadge.textContent = '● Voting Open';
                } else if (phase === 'SCHEDULED') {
                    electionBadge.className = 'status-badge pending';
                    electionBadge.textContent = '● Voting Scheduled';
                } else if (phase === 'RESULTS_PUBLISHED') {
                    electionBadge.className = 'status-badge live';
                    electionBadge.textContent = '● Results Published';
                } else {
                    electionBadge.className = 'status-badge neutral';
                    electionBadge.textContent = `● Election ${phase}`;
                }
            }

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
                    heroBtn.innerHTML = '<i class="fas fa-poll"></i> View Certified Results &rarr;';
                    heroBtn.href = 'v-result.html';
                    heroBtn.style.backgroundColor = '#1D4ED8';
                }
            } else {
                if (badge) {
                    badge.className = 'status-badge pending';
                    badge.textContent = 'Ready to Vote';
                }

                if (heroBtn) {
                    if (phase === 'VOTING') {
                        heroBtn.innerHTML = '<i class="fas fa-vote-yea"></i> CAST YOUR VOTE &rarr;';
                        heroBtn.href = 'v-vote.html';
                        heroBtn.style.backgroundColor = 'var(--success)';
                        heroBtn.style.pointerEvents = 'auto';
                    } else if (phase === 'SCHEDULED') {
                        heroBtn.innerHTML = '<i class="fas fa-clock"></i> Voting Opens Soon';
                        heroBtn.href = 'javascript:void(0)';
                        heroBtn.style.backgroundColor = 'var(--surface-secondary)';
                        heroBtn.style.color = 'var(--text-muted)';
                    } else {
                        heroBtn.innerHTML = '<i class="fas fa-lock"></i> Voting Concluded';
                        heroBtn.href = 'v-result.html';
                        heroBtn.style.backgroundColor = '#1D4ED8';
                    }
                }
            }
        }
    } catch (err) {
        console.error('Voter profile load error:', err);
    }
}

loadVoterDashboard();
