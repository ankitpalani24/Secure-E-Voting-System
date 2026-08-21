// ==========================================================================
// CITIZEN VOTER DASHBOARD & ELECTION-SCOPED STATUS CONTROLLER
// ==========================================================================

let accreditedElections = [];
let selectedElectionId = null;
let currentCategoryFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Voter Access
    if (!checkAuth('voter')) return;

    const userName = localStorage.getItem('userName') || 'Citizen';
    const welcomeHeader = document.getElementById('voterWelcomeHeader');
    const profileName = document.getElementById('voterProfileName');

    if (welcomeHeader) welcomeHeader.textContent = `Welcome, ${userName}`;
    if (profileName) profileName.textContent = userName;

    // 2. Setup Category Tabs
    setupCategoryTabs();

    // 3. Load Elections and inspect URL for ?electionId=...
    await loadVoterElections();
});

function setupCategoryTabs() {
    const tabsContainer = document.getElementById('electionCategoryTabs');
    if (!tabsContainer) return;

    const buttons = tabsContainer.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategoryFilter = btn.getAttribute('data-filter') || 'ALL';
            renderElectionsGrid();
        };
    });
}

// ================= LOAD ELECTIONS =================
async function loadVoterElections() {
    const container = document.getElementById('voterEligibleElectionsContainer');
    if (!container) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/voter/elections', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            handleAuthResponse(res);
            throw new Error('Failed to load eligible elections');
        }

        accreditedElections = await res.json();
        renderElectionsGrid();

        // Check if electionId is in URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlElectionId = urlParams.get('electionId');

        if (urlElectionId) {
            await selectElection(urlElectionId);
        } else if (accreditedElections.length === 1) {
            await selectElection(accreditedElections[0]._id);
        }
    } catch (err) {
        console.error('Failed to load voter elections:', err);
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top: 8px;">Failed to load elections. Please try refreshing.</p>
            </div>
        `;
    }
}

// ================= RENDER ELECTIONS GRID =================
function renderElectionsGrid() {
    const container = document.getElementById('voterEligibleElectionsContainer');
    if (!container) return;

    let filtered = accreditedElections;
    if (currentCategoryFilter === 'ACTIVE') {
        filtered = accreditedElections.filter(e => e.phase === 'VOTING');
    } else if (currentCategoryFilter === 'UPCOMING') {
        filtered = accreditedElections.filter(e => e.phase === 'SCHEDULED' || e.phase === 'DRAFT');
    } else if (currentCategoryFilter === 'COMPLETED') {
        filtered = accreditedElections.filter(e => e.phase === 'CLOSED' || e.phase === 'RESULTS_PUBLISHED' || e.phase === 'ARCHIVED');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 36px; background: var(--surface-muted); border-radius: var(--radius-lg); color: var(--text-muted);">
                <i class="fas fa-layer-group fa-2x" style="margin-bottom: 8px;"></i>
                <p>No elections found in this category.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(el => {
        const jName = el.jurisdiction?.name || 'National General';
        const jType = el.jurisdiction?.type || el.electionType || 'NATIONAL';
        const isSelected = selectedElectionId === el._id;
        const phaseBadge = getPhaseBadge(el.phase);

        const isVoting = el.phase === 'VOTING';
        const startStr = new Date(el.startDate).toLocaleDateString();
        const endStr = new Date(el.endDate).toLocaleDateString();

        // Vote status for THIS specific election
        const voteStatusBadge = el.hasVoted
            ? `<span class="status-badge live" style="font-size: 0.72rem;"><i class="fas fa-check-circle"></i> VOTE RECORDED</span>`
            : `<span class="status-badge pending" style="font-size: 0.72rem;"><i class="fas fa-clock"></i> NOT YET VOTED</span>`;

        return `
            <div class="election-card ${isSelected ? 'selected-card' : ''}" style="cursor: pointer; ${isSelected ? 'border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-border);' : ''}" onclick="selectElection('${el._id}')">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: var(--surface-muted); padding: 2px 8px; border-radius: 4px; color: var(--text-secondary);">
                            <i class="fas fa-landmark"></i> ${escapeHtml(jType)} &bull; ${escapeHtml(jName)}
                        </span>
                        ${phaseBadge}
                    </div>
                    <h4 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 6px;">${escapeHtml(el.title)}</h4>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
                        ${escapeHtml(el.description || 'Standard electronic democratic election.')}
                    </p>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 14px;">
                        <i class="fas fa-calendar-alt"></i> ${startStr} &rarr; ${endStr}
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div>${voteStatusBadge}</div>
                    <button type="button" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;">
                        ${isSelected ? '<i class="fas fa-check"></i> Selected' : 'View Status'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getPhaseBadge(phase) {
    switch (phase) {
        case 'VOTING':
            return `<span class="status-badge live" style="font-size: 0.72rem;">● VOTING NOW</span>`;
        case 'SCHEDULED':
            return `<span class="status-badge pending" style="font-size: 0.72rem;">○ UPCOMING</span>`;
        case 'CLOSED':
            return `<span class="status-badge closed" style="font-size: 0.72rem;">CLOSED</span>`;
        case 'RESULTS_PUBLISHED':
            return `<span class="status-badge published" style="font-size: 0.72rem;">RESULTS CERTIFIED</span>`;
        default:
            return `<span class="status-badge neutral" style="font-size: 0.72rem;">${escapeHtml(phase)}</span>`;
    }
}

// ================= SELECT ELECTION & LOAD SCOPED STATUS =================
async function selectElection(electionId) {
    if (!electionId) return;
    selectedElectionId = electionId;

    // Update URL query parameter without full reload
    const newUrl = `${window.location.pathname}?electionId=${encodeURIComponent(electionId)}`;
    window.history.pushState({ electionId }, '', newUrl);

    // Refresh grid to highlight selected card
    renderElectionsGrid();

    const unselectedPrompt = document.getElementById('unselectedElectionPrompt');
    const contentArea = document.getElementById('selectedElectionContent');

    if (!contentArea) return;

    if (unselectedPrompt) unselectedPrompt.classList.add('hidden');
    contentArea.classList.remove('hidden');

    contentArea.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top: 8px;">Retrieving your election-specific accreditation status...</p>
        </div>
    `;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/voter/elections/${electionId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            handleAuthResponse(res);
            throw new Error('Could not fetch election-specific voting status');
        }

        const status = await res.json();
        renderSelectedElectionStatus(status);
    } catch (err) {
        contentArea.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top: 8px;">${escapeHtml(err.message || 'Failed to load status for selected election.')}</p>
            </div>
        `;
    }
}

function renderSelectedElectionStatus(status) {
    const contentArea = document.getElementById('selectedElectionContent');
    if (!contentArea) return;

    const jName = status.jurisdiction?.name || 'National General';
    const jType = status.jurisdiction?.type || status.electionType || 'NATIONAL';
    const isVoting = status.phase === 'VOTING';
    const startStr = new Date(status.startDate).toLocaleDateString() + ' ' + new Date(status.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endStr = new Date(status.endDate).toLocaleDateString() + ' ' + new Date(status.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let actionBtnHtml = '';
    let statusTextHtml = '';

    if (status.hasVoted) {
        statusTextHtml = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--success-light); border: 1px solid var(--success-border); border-radius: var(--radius-md); color: var(--success-text);">
                <i class="fas fa-check-circle" style="font-size: 1.3rem;"></i>
                <div>
                    <strong style="display: block; font-size: 0.95rem;">✓ VOTE RECORDED & SEALED</strong>
                    <span style="font-size: 0.8rem;">Your anonymous ballot was cryptographically committed for this election slate.</span>
                </div>
            </div>
        `;
        actionBtnHtml = `
            <a href="v-result.html?electionId=${status.electionId}" class="btn-primary" style="background-color: #1D4ED8; text-decoration: none; padding: 12px 24px; font-weight: 600;">
                <i class="fas fa-poll"></i> View Results Standings &rarr;
            </a>
        `;
    } else if (!status.eligible) {
        statusTextHtml = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--danger-light); border: 1px solid var(--danger-border); border-radius: var(--radius-md); color: var(--danger-text);">
                <i class="fas fa-ban" style="font-size: 1.3rem;"></i>
                <div>
                    <strong style="display: block; font-size: 0.95rem;">Not Accredited For This Election</strong>
                    <span style="font-size: 0.8rem;">${escapeHtml(status.eligibilityReason || 'Your voter profile is not registered in this jurisdiction.')}</span>
                </div>
            </div>
        `;
        actionBtnHtml = `
            <button type="button" class="btn-secondary" disabled style="padding: 12px 24px; opacity: 0.6;">
                Ineligible For Ballot
            </button>
        `;
    } else if (isVoting && status.isVotingAllowed) {
        statusTextHtml = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--primary-subtle); border: 1px solid var(--primary-border); border-radius: var(--radius-md); color: var(--primary-dark);">
                <i class="fas fa-vote-yea" style="font-size: 1.3rem;"></i>
                <div>
                    <strong style="display: block; font-size: 0.95rem;">Vote Status: NOT YET VOTED</strong>
                    <span style="font-size: 0.8rem;">The voting chamber is actively open. You are accredited to cast your ballot.</span>
                </div>
            </div>
        `;
        actionBtnHtml = `
            <a href="v-vote.html?electionId=${status.electionId}" class="btn-primary" style="background-color: var(--success); text-decoration: none; padding: 14px 28px; font-size: 1.05rem; font-weight: 700; box-shadow: 0 4px 12px rgba(47, 125, 50, 0.3);">
                <i class="fas fa-vote-yea"></i> CAST YOUR VOTE &rarr;
            </a>
        `;
    } else if (status.phase === 'SCHEDULED') {
        statusTextHtml = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--warning-light); border: 1px solid var(--warning-border); border-radius: var(--radius-md); color: var(--warning-text);">
                <i class="fas fa-clock" style="font-size: 1.3rem;"></i>
                <div>
                    <strong style="display: block; font-size: 0.95rem;">Voting Opens Soon</strong>
                    <span style="font-size: 0.8rem;">Voting window opens at ${startStr}.</span>
                </div>
            </div>
        `;
        actionBtnHtml = `
            <button type="button" class="btn-secondary" disabled style="padding: 12px 24px;">
                Voting Opens ${startStr}
            </button>
        `;
    } else {
        statusTextHtml = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-secondary);">
                <i class="fas fa-lock" style="font-size: 1.3rem;"></i>
                <div>
                    <strong style="display: block; font-size: 0.95rem;">Voting Concluded (${escapeHtml(status.phase)})</strong>
                    <span style="font-size: 0.8rem;">The voting window for this election slate is closed.</span>
                </div>
            </div>
        `;
        actionBtnHtml = `
            <a href="v-result.html?electionId=${status.electionId}" class="btn-secondary" style="text-decoration: none; padding: 12px 24px;">
                <i class="fas fa-poll"></i> View Results
            </a>
        `;
    }

    contentArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
            <div>
                <span class="status-badge pending" style="margin-bottom: 6px; font-size: 0.72rem; text-transform: uppercase;">
                    <i class="fas fa-landmark"></i> ${escapeHtml(jType)} &bull; ${escapeHtml(jName)}
                </span>
                <h2 style="font-size: 1.4rem; color: var(--text-primary); margin-top: 4px;">${escapeHtml(status.title)}</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(status.description || 'Standard electronic democratic election.')}</p>
            </div>
            <div>
                ${getPhaseBadge(status.phase)}
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
            <!-- Accreditation Checklist for THIS Election -->
            <div style="background-color: var(--surface-muted); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <h4 style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 12px;"><i class="fas fa-clipboard-check" style="color: var(--primary);"></i> Accreditation Checklist</h4>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: ${status.eligible ? 'var(--success)' : 'var(--danger)'};"></i>
                        <span>Accredited for ${escapeHtml(jName)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-check-circle" style="color: ${status.hasBiometrics ? 'var(--success)' : 'var(--warning)'};"></i>
                        <span>Facial Biometric Enrolled</span>
                    </div>
                </div>
            </div>

            <!-- Schedule -->
            <div style="background-color: var(--surface-muted); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <h4 style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 12px;"><i class="fas fa-calendar-alt" style="color: var(--primary);"></i> Voting Schedule</h4>
                <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
                    <div><strong>Window Opens:</strong> ${startStr}</div>
                    <div><strong>Window Closes:</strong> ${endStr}</div>
                </div>
            </div>
        </div>

        <!-- Status Message Box -->
        <div style="margin-bottom: 24px;">
            ${statusTextHtml}
        </div>

        <!-- Action Call to Action -->
        <div style="display: flex; justify-content: flex-end; align-items: center;">
            ${actionBtnHtml}
        </div>
    `;
}

window.selectElection = selectElection;

