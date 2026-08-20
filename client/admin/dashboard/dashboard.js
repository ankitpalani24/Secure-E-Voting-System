let allAuditLogs = [];
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
        } else {
            showToast(data.message || 'Transition rejected by election engine.', 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast('Network error during phase transition: ' + err.message, 'error');
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

// Event Listeners
const verifyBtn = document.getElementById('verifyChainBtn');
if (verifyBtn) verifyBtn.onclick = verifyAuditChain;

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

// Real-time socket updates
const socket = window.io ? window.io(window.location.origin) : null;
if (socket) {
    socket.on('newVote', () => {
        loadDashboardStats();
        loadAuditLogs();
    });
    socket.on('electionPhaseUpdated', (payload) => {
        loadElectionOperations();
        loadAuditLogs();
        loadDashboardStats();
    });
}
