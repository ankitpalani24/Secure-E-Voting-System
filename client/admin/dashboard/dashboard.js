let allAuditLogs = [];
let allProposals = [];
let activeElection = null;
let countdownTimerInterval = null;

// ================== SIDEBAR MOBILE TOGGLE ==================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// ================== ELECTION OPERATIONS & LIFECYCLE ==================
async function loadElectionOperations() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/elections', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;

        const elections = await res.json();
        if (Array.isArray(elections) && elections.length > 0) {
            activeElection = elections[0]; // Active/default slate
            renderElectionControlCenter(activeElection);
            startRealElectionClock(activeElection);
        }
    } catch (err) {
        console.error('Election load error:', err);
    }
}

function renderElectionControlCenter(election) {
    if (!election) return;

    const titleEl = document.getElementById('activeElectionTitle');
    const phasePill = document.getElementById('activePhasePill');
    const topPhaseBadge = document.getElementById('electionPhaseBadge');
    const startEl = document.getElementById('electionStartTime');
    const endEl = document.getElementById('electionEndTime');
    const visibilityEl = document.getElementById('resultsVisibilityStatus');

    const cleanTitle = typeof escapeHtml === 'function' ? escapeHtml(election.title) : election.title;
    if (titleEl) titleEl.textContent = cleanTitle;

    const phase = election.phase || 'VOTING';
    if (phasePill) {
        phasePill.textContent = `Phase: ${phase}`;
        phasePill.className = `status-badge ${phase === 'VOTING' ? 'live' : phase === 'CLOSED' ? 'pending' : 'neutral'}`;
    }
    if (topPhaseBadge) {
        topPhaseBadge.textContent = `Voting Phase: ${phase}`;
        topPhaseBadge.className = `status-badge ${phase === 'VOTING' ? 'live' : phase === 'CLOSED' ? 'pending' : 'neutral'}`;
    }

    if (startEl) startEl.textContent = election.startDate ? new Date(election.startDate).toLocaleString() : 'N/A';
    if (endEl) endEl.textContent = election.endDate ? new Date(election.endDate).toLocaleString() : 'N/A';

    if (visibilityEl) {
        if (phase === 'RESULTS_PUBLISHED') {
            visibilityEl.textContent = '✓ Publicly Published';
            visibilityEl.style.color = 'var(--success-text)';
        } else if (election.publishLiveTally) {
            visibilityEl.textContent = '● Live Tally Enabled';
            visibilityEl.style.color = 'var(--primary)';
        } else {
            visibilityEl.textContent = '🔒 Embargoed to Public';
            visibilityEl.style.color = 'var(--warning-text)';
        }
    }

    // Dynamic State Transition Button Enabling
    const btnSchedule = document.getElementById('btnTransitionSchedule');
    const btnOpen = document.getElementById('btnTransitionOpenVoting');
    const btnClose = document.getElementById('btnTransitionCloseVoting');
    const btnPublish = document.getElementById('btnTransitionPublishResults');
    const btnArchive = document.getElementById('btnTransitionArchive');

    if (btnSchedule) btnSchedule.disabled = !(phase === 'DRAFT');
    if (btnOpen) btnOpen.disabled = !(phase === 'SCHEDULED');
    if (btnClose) btnClose.disabled = !(phase === 'VOTING');
    if (btnPublish) btnPublish.disabled = !(phase === 'CLOSED');
    if (btnArchive) btnArchive.disabled = !(phase === 'CLOSED' || phase === 'RESULTS_PUBLISHED' || phase === 'DRAFT');
}

async function handlePhaseTransition(targetPhase) {
    if (!activeElection || !activeElection._id) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    // Offer two-person governance proposal workflow for sensitive actions
    const isSensitive = targetPhase === 'VOTING' || targetPhase === 'CLOSED' || targetPhase === 'RESULTS_PUBLISHED' || targetPhase === 'ARCHIVED';
    const actionMap = {
        'VOTING': 'OPEN_VOTING',
        'CLOSED': 'CLOSE_VOTING',
        'RESULTS_PUBLISHED': 'PUBLISH_RESULTS',
        'ARCHIVED': 'ARCHIVE_ELECTION'
    };

    if (isSensitive) {
        const action = actionMap[targetPhase];
        const reason = prompt(`Submit Two-Person Governance Proposal to '${action}'?\nEnter operational reason:`, `Scheduled transition to ${targetPhase}`);
        if (reason === null) return;

        showSpinner(`Submitting ${action} Governance Proposal...`);
        try {
            const res = await fetch('/api/admin/proposals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    electionId: activeElection._id,
                    action,
                    reason
                })
            });

            const data = await res.json();
            hideSpinner();

            if (res.ok) {
                showToast(`✓ Proposal created! Awaiting secondary administrator review.`, 'success');
                loadGovernanceProposals();
                loadAuditLogs();
            } else {
                showToast(data.message || 'Proposal rejected by governance engine.', 'error');
            }
        } catch (err) {
            hideSpinner();
            showToast('Network error during proposal submission: ' + err.message, 'error');
        }
        return;
    }

    if (!confirm(`Are you sure you want to transition election to '${targetPhase}' phase?`)) {
        return;
    }

    showSpinner(`Transitioning Election to ${targetPhase}...`);

    try {
        const res = await fetch('/api/admin/update-phase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                electionId: activeElection._id,
                phase: targetPhase
            })
        });

        const data = await res.json();
        hideSpinner();

        if (res.ok && data.election) {
            activeElection = data.election;
            renderElectionControlCenter(activeElection);
            showToast(`✓ Election transitioned to ${targetPhase}`, 'success');
            loadAuditLogs();
            loadDashboardStats();
            loadGovernanceProposals();
        } else {
            showToast(data.message || 'Transition rejected by election engine.', 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast('Network error during phase transition: ' + err.message, 'error');
    }
}

// ================== TWO-PERSON GOVERNANCE QUEUE ==================
async function loadGovernanceProposals() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/proposals', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            allProposals = await res.json();
            renderGovernanceProposals(allProposals);
        }
    } catch (err) {
        console.error('Governance proposals load error:', err);
    }
}

function renderGovernanceProposals(proposals) {
    const container = document.getElementById('governanceProposalsList');
    const badge = document.getElementById('pendingProposalsCountBadge');
    if (!container) return;

    container.innerHTML = '';

    const pendingProposals = proposals.filter(p => p.status === 'PENDING');
    if (badge) {
        badge.textContent = `${pendingProposals.length} Pending Approval${pendingProposals.length === 1 ? '' : 's'}`;
        badge.className = `status-badge ${pendingProposals.length > 0 ? 'pending' : 'neutral'}`;
    }

    if (!Array.isArray(proposals) || proposals.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No operational approval proposals in queue.</p>';
        return;
    }

    const currentAdminName = localStorage.getItem('userName') || 'Admin';

    proposals.slice(0, 8).forEach(proposal => {
        const isPending = proposal.status === 'PENDING';
        const isSelf = proposal.requestedByUsername === currentAdminName;

        const card = document.createElement('div');
        card.style.cssText = 'background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;';

        const infoDiv = document.createElement('div');
        infoDiv.style.maxWidth = '520px';

        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

        const actionTag = document.createElement('strong');
        actionTag.style.color = 'var(--text-primary)';
        actionTag.textContent = proposal.action.replace('_', ' ');

        const statusTag = document.createElement('span');
        statusTag.className = `status-badge ${isPending ? 'pending' : proposal.status === 'EXECUTED' ? 'live' : 'neutral'}`;
        statusTag.textContent = proposal.status;

        headerDiv.appendChild(actionTag);
        headerDiv.appendChild(statusTag);

        const subtext = document.createElement('p');
        subtext.style.cssText = 'font-size: 0.82rem; color: var(--text-secondary); margin: 0;';
        subtext.innerHTML = `Requested by <strong>${proposal.requestedByUsername || 'Admin'}</strong> on ${new Date(proposal.createdAt || proposal.requestedAt).toLocaleString()}<br><em>Reason: ${proposal.reason || 'Standard operation'}</em>`;

        infoDiv.appendChild(headerDiv);
        infoDiv.appendChild(subtext);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        if (isPending) {
            if (isSelf) {
                const selfBadge = document.createElement('span');
                selfBadge.style.cssText = 'font-size: 0.78rem; color: var(--warning-text); background: var(--warning-light); border: 1px solid var(--warning-border); padding: 4px 10px; border-radius: var(--radius-sm); font-weight: 600;';
                selfBadge.innerHTML = '<i class="fas fa-user-clock"></i> Your Proposal (Awaiting Peer Review)';
                actionsDiv.appendChild(selfBadge);
            } else {
                const approveBtn = document.createElement('button');
                approveBtn.className = 'btn-primary';
                approveBtn.style.cssText = 'padding: 6px 14px; font-size: 0.82rem; background-color: var(--success);';
                approveBtn.innerHTML = '<i class="fas fa-check"></i> Authorize & Execute';
                approveBtn.onclick = () => handleApproveProposal(proposal._id, proposal.action);

                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'btn-secondary';
                rejectBtn.style.cssText = 'padding: 6px 12px; font-size: 0.82rem; color: var(--danger-text);';
                rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
                rejectBtn.onclick = () => handleRejectProposal(proposal._id, proposal.action);

                actionsDiv.appendChild(approveBtn);
                actionsDiv.appendChild(rejectBtn);
            }
        } else if (proposal.status === 'EXECUTED') {
            const executedText = document.createElement('span');
            executedText.style.cssText = 'font-size: 0.78rem; color: var(--success-text); font-weight: 600;';
            executedText.textContent = `✓ Authorized by ${proposal.approvedByUsername || 'Peer Officer'}`;
            actionsDiv.appendChild(executedText);
        } else if (proposal.status === 'REJECTED') {
            const rejectedText = document.createElement('span');
            rejectedText.style.cssText = 'font-size: 0.78rem; color: var(--danger-text); font-weight: 600;';
            rejectedText.textContent = `✕ Rejected by ${proposal.approvedByUsername || 'Reviewer'}`;
            actionsDiv.appendChild(rejectedText);
        }

        card.appendChild(infoDiv);
        card.appendChild(actionsDiv);
        container.appendChild(card);
    });
}

async function handleApproveProposal(id, action) {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm(`Are you sure you want to AUTHORIZE and EXECUTE action '${action}'?`)) {
        return;
    }

    showSpinner(`Authorizing & Executing ${action}...`);

    try {
        const res = await fetch(`/api/admin/proposals/${id}/approve`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();
        hideSpinner();

        if (res.ok) {
            showToast(`✓ Dual-admin consensus reached! Action ${action} executed.`, 'success');
            loadElectionOperations();
            loadGovernanceProposals();
            loadAuditLogs();
            loadDashboardStats();
        } else {
            showToast(data.message || 'Authorization failed.', 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast('Network error during authorization: ' + err.message, 'error');
    }
}

async function handleRejectProposal(id, action) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const reason = prompt(`Reason for rejecting '${action}' proposal:`, 'Operational requirements not met');
    if (reason === null) return;

    showSpinner(`Rejecting Proposal...`);

    try {
        const res = await fetch(`/api/admin/proposals/${id}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
        });

        const data = await res.json();
        hideSpinner();

        if (res.ok) {
            showToast(`Proposal rejected.`, 'info');
            loadGovernanceProposals();
            loadAuditLogs();
        } else {
            showToast(data.message || 'Rejection failed.', 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast('Network error: ' + err.message, 'error');
    }
}

// ================== ELECTION COUNTDOWN CLOCK (REAL-TIME BOUND) ==================
function startRealElectionClock(election) {
    if (countdownTimerInterval) clearInterval(countdownTimerInterval);

    const updateClock = () => {
        const hEl = document.getElementById('timerHours');
        const mEl = document.getElementById('timerMins');
        const sEl = document.getElementById('timerSecs');
        if (!hEl || !mEl || !sEl) return;

        if (!election || !election.endDate) {
            hEl.textContent = '00';
            mEl.textContent = '00';
            sEl.textContent = '00';
            return;
        }

        const now = Date.now();
        const end = new Date(election.endDate).getTime();
        const diffMs = end - now;

        if (diffMs <= 0 || election.phase !== 'VOTING') {
            hEl.textContent = '00';
            mEl.textContent = '00';
            sEl.textContent = '00';
            return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        hEl.textContent = String(hours).padStart(2, '0');
        mEl.textContent = String(mins).padStart(2, '0');
        sEl.textContent = String(secs).padStart(2, '0');
    };

    updateClock();
    countdownTimerInterval = setInterval(updateClock, 1000);
}

// ================== AUDIT LOG EXPLORER ==================
async function loadAuditLogs() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/audit-logs?limit=25', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            allAuditLogs = data.logs || [];
            renderAuditLogs(allAuditLogs);
        }
    } catch (err) {
        console.error('Audit log fetch error:', err);
    }
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(logs) || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No security events found.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');

        const timeTd = document.createElement('td');
        timeTd.textContent = log.time ? new Date(log.time).toLocaleTimeString() : 'N/A';
        timeTd.style.whiteSpace = 'nowrap';
        timeTd.style.fontWeight = '500';

        const catTd = document.createElement('td');
        const catBadge = document.createElement('span');
        catBadge.className = 'status-badge ' + (log.category === 'SECURITY_EVENT' ? 'pending' : 'live');
        catBadge.textContent = log.category || 'AUDIT_EVENT';
        catTd.appendChild(catBadge);

        const actionTd = document.createElement('td');
        actionTd.textContent = log.action || 'EVENT';
        actionTd.style.fontWeight = '600';

        const roleTd = document.createElement('td');
        roleTd.textContent = log.userRole || 'system';
        roleTd.style.textTransform = 'capitalize';

        const hashTd = document.createElement('td');
        const hashBadge = document.createElement('span');
        hashBadge.style.cssText = 'font-family: monospace; font-size: 0.78rem; background: var(--surface-secondary); padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border);';
        const hashStr = log.currentHash ? log.currentHash.substring(0, 16) + '...' : 'Genesis Block';
        hashBadge.textContent = hashStr;
        hashBadge.title = log.currentHash || 'Genesis Block';
        hashTd.appendChild(hashBadge);

        tr.appendChild(timeTd);
        tr.appendChild(catTd);
        tr.appendChild(actionTd);
        tr.appendChild(roleTd);
        tr.appendChild(hashTd);

        tbody.appendChild(tr);
    });
}

// ================== AUDIT CHAIN VERIFIER ==================
async function verifyAuditChain() {
    const token = localStorage.getItem('token');
    const banner = document.getElementById('chainVerificationBanner');
    const btn = document.getElementById('verifyChainBtn');
    if (!banner || !btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    try {
        const res = await fetch('/api/admin/audit-verify', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        banner.className = '';
        if (data.valid) {
            banner.style.backgroundColor = 'var(--success-light)';
            banner.style.color = 'var(--success-text)';
            banner.style.border = '1px solid var(--success-border)';
            banner.innerHTML = `<i class="fas fa-check-circle"></i> <strong>✓ Audit Chain Verified:</strong> Validated all ${data.totalRecords || 0} audit records sequentially with 0 broken links.`;
            showToast('Audit hash chain verified: 100% intact!', 'success');
        } else {
            banner.style.backgroundColor = 'var(--danger-light)';
            banner.style.color = 'var(--danger-text)';
            banner.style.border = '1px solid var(--danger-border)';
            banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>⚠ Audit Chain Integrity Failure:</strong> Break detected at record #${data.brokenAt}.`;
            showToast('Audit integrity warning!', 'error');
        }
    } catch (err) {
        showToast('Chain verification network error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link"></i> Verify Hash Chain';
    }
}

// ================== DASHBOARD STATS ==================
async function loadDashboardStats() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const userName = localStorage.getItem('userName') || 'Electoral Admin';
    const adminUserEl = document.getElementById('adminUserName');
    if (adminUserEl) adminUserEl.textContent = userName;

    try {
        const res = await fetch('/api/admin/stats', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load statistics");

        const data = await res.json();

        // 1. Update KPI Values
        const votersCount = data.votersCount || 0;
        const votesCount = data.votesCount || 0;
        const partiesCount = data.partiesCount || 0;

        const vEl = document.getElementById('votersCountVal');
        const voEl = document.getElementById('votesCountVal');
        const pEl = document.getElementById('partiesCountVal');

        if (vEl) vEl.textContent = votersCount.toLocaleString();
        if (voEl) voEl.textContent = votesCount.toLocaleString();
        if (pEl) pEl.textContent = partiesCount.toLocaleString();

        const statCards = document.querySelectorAll('.stat-card .value');
        if (statCards.length >= 3) {
            statCards[0].textContent = votersCount;
            statCards[1].textContent = votesCount;
            statCards[2].textContent = partiesCount;
        }

        // 2. Turnout Calculations
        const turnoutPct = votersCount > 0 ? ((votesCount / votersCount) * 100).toFixed(1) : "0.0";

        const turnoutRateValue = document.getElementById('turnoutRateValue');
        const turnoutRatioText = document.getElementById('turnoutRatioText');
        const turnoutText = document.getElementById('turnoutPercentage');
        const turnoutBar = document.getElementById('turnoutProgressBar');

        if (turnoutRateValue) turnoutRateValue.textContent = `${turnoutPct}%`;
        if (turnoutRatioText) turnoutRatioText.textContent = `${votesCount} / ${votersCount} participated`;
        if (turnoutText) turnoutText.textContent = `${turnoutPct}% Turnout (${votesCount} / ${votersCount})`;
        if (turnoutBar) turnoutBar.style.width = `${Math.min(parseFloat(turnoutPct), 100)}%`;

    } catch (err) {
        console.error('Stats error:', err);
    }
}

// Initializations
loadElectionOperations();
loadDashboardStats();
loadAuditLogs();
loadGovernanceProposals();

// Event Listeners
const verifyBtn = document.getElementById('verifyChainBtn');
if (verifyBtn) verifyBtn.onclick = verifyAuditChain;

const refreshPropBtn = document.getElementById('refreshProposalsBtn');
if (refreshPropBtn) refreshPropBtn.onclick = loadGovernanceProposals;

const btnSchedule = document.getElementById('btnTransitionSchedule');
if (btnSchedule) btnSchedule.onclick = () => handlePhaseTransition('SCHEDULED');

const btnOpen = document.getElementById('btnTransitionOpenVoting');
if (btnOpen) btnOpen.onclick = () => handlePhaseTransition('VOTING');

const btnClose = document.getElementById('btnTransitionCloseVoting');
if (btnClose) btnClose.onclick = () => handlePhaseTransition('CLOSED');

const btnPublish = document.getElementById('btnTransitionPublishResults');
if (btnPublish) btnPublish.onclick = () => handlePhaseTransition('RESULTS_PUBLISHED');

const btnArchive = document.getElementById('btnTransitionArchive');
if (btnArchive) btnArchive.onclick = () => handlePhaseTransition('ARCHIVED');

const filterSelect = document.getElementById('auditCategoryFilter');
if (filterSelect) {
    filterSelect.onchange = () => {
        const cat = filterSelect.value;
        if (cat === 'ALL') {
            renderAuditLogs(allAuditLogs);
        } else {
            renderAuditLogs(allAuditLogs.filter(l => l.category === cat));
        }
    };
}

// ================== GLOBAL COMMAND PALETTE (CTRL+K) ==================
const cmdModal = document.getElementById('commandPaletteModal');
const cmdInput = document.getElementById('commandSearchInput');
const cmdList = document.getElementById('commandResultsList');
const openCmdBtn = document.getElementById('openCommandPaletteBtn');
const cmdVerifyAudit = document.getElementById('cmdVerifyAudit');

function openCommandPalette() {
    if (!cmdModal) return;
    cmdModal.classList.remove('hidden');
    if (cmdInput) {
        cmdInput.value = '';
        cmdInput.focus();
        filterCommands('');
    }
}

function closeCommandPalette() {
    if (!cmdModal) return;
    cmdModal.classList.add('hidden');
}

function filterCommands(query) {
    if (!cmdList) return;
    const q = query.toLowerCase().trim();
    const items = cmdList.querySelectorAll('.command-item');
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

if (openCmdBtn) openCmdBtn.onclick = openCommandPalette;

if (cmdInput) {
    cmdInput.oninput = () => filterCommands(cmdInput.value);
}

if (cmdVerifyAudit) {
    cmdVerifyAudit.onclick = () => {
        closeCommandPalette();
        verifyAuditChain();
    };
}

if (cmdModal) {
    cmdModal.onclick = (e) => {
        if (e.target === cmdModal) closeCommandPalette();
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (cmdModal && !cmdModal.classList.contains('hidden')) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
    } else if (e.key === 'Escape') {
        closeCommandPalette();
    }
});

// Real-time socket updates
const socket = window.io ? window.io(window.location.origin) : null;
if (socket) {
    socket.on('newVote', () => {
        loadDashboardStats();
        loadAuditLogs();
    });
    socket.on('electionPhaseUpdated', () => {
        loadElectionOperations();
        loadAuditLogs();
        loadDashboardStats();
        loadGovernanceProposals();
    });
    socket.on('governanceProposalCreated', () => {
        loadGovernanceProposals();
        loadAuditLogs();
    });
    socket.on('governanceProposalResolved', () => {
        loadGovernanceProposals();
        loadElectionOperations();
        loadAuditLogs();
        loadDashboardStats();
    });
}

