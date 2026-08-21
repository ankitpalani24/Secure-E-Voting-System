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
        // Parallel fetch profile & eligible elections
        const [profileRes, electionsRes] = await Promise.all([
            fetch('/api/voter/profile', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/voter/elections', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (profileRes.ok) {
            const profile = await profileRes.json();

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
                        heroBtn.href = election._id ? `v-vote.html?electionId=${election._id}` : 'v-vote.html';
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

        // Render eligible elections list
        if (electionsRes.ok) {
            const elections = await electionsRes.json();
            renderEligibleElections(elections);
        }
    } catch (err) {
        console.error('Voter profile load error:', err);
    }
}

function renderEligibleElections(elections) {
    const container = document.getElementById('voterEligibleElectionsContainer');
    if (!container) return;

    if (!elections || elections.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-muted);">
                <i class="fas fa-info-circle fa-2x" style="margin-bottom: 8px;"></i>
                <p>No active elections assigned to your jurisdiction profile at this time.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = elections.map(el => {
        const jName = el.jurisdiction?.name || 'National Territory';
        const jType = el.jurisdiction?.type || el.electionType || 'NATIONAL';
        const isVoting = el.phase === 'VOTING';
        const isScheduled = el.phase === 'SCHEDULED';
        const isPublished = el.phase === 'RESULTS_PUBLISHED';

        let actionBtn = '';
        let badgeClass = 'pending';
        let badgeText = el.phase;

        if (isVoting) {
            badgeClass = 'live';
            badgeText = '● Voting Open';
            if (el.hasVoted) {
                actionBtn = `<span class="status-badge live" style="font-size: 0.78rem;"><i class="fas fa-check-circle"></i> Voted</span>`;
            } else {
                actionBtn = `
                    <a href="v-vote.html?electionId=${el._id}" class="btn-primary" style="background-color: var(--success); padding: 8px 16px; font-size: 0.82rem; text-decoration: none;">
                        <i class="fas fa-vote-yea"></i> Cast Ballot &rarr;
                    </a>
                `;
            }
        } else if (isScheduled) {
            badgeClass = 'pending';
            badgeText = '○ Scheduled';
            actionBtn = `<span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Opens ${new Date(el.startDate).toLocaleDateString()}</span>`;
        } else if (isPublished) {
            badgeClass = 'published';
            badgeText = 'Results Certified';
            actionBtn = `
                <a href="v-result.html?electionId=${el._id}" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; text-decoration: none;">
                    <i class="fas fa-chart-bar"></i> View Results
                </a>
            `;
        } else {
            badgeClass = 'neutral';
            badgeText = el.phase;
            actionBtn = `<span style="font-size: 0.78rem; color: var(--text-muted);">Voting Concluded</span>`;
        }

        return `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm);">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: var(--surface-muted); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">
                            <i class="fas fa-landmark"></i> ${escapeHtml(jType)}
                        </span>
                        <span class="status-badge ${badgeClass}" style="font-size: 0.72rem;">${badgeText}</span>
                    </div>
                    <h4 style="font-size: 1.05rem; color: var(--text-primary); margin-bottom: 6px;">${escapeHtml(el.title)}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">${escapeHtml(el.description || 'Official democratic election slate.')}</p>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px;">
                        <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> ${escapeHtml(jName)}
                    </div>
                </div>
                <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: flex-end; align-items: center;">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

loadVoterDashboard();
