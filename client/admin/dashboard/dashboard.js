let allAuditLogs = [];

// ================== SIDEBAR MOBILE TOGGLE ==================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// ================== ELECTION COUNTDOWN CLOCK ==================
function startElectionClock() {
    let remainingSeconds = 12 * 3600 + 45 * 60; // 12h 45m simulation
    
    setInterval(() => {
        if (remainingSeconds <= 0) return;
        remainingSeconds--;

        const hours = Math.floor(remainingSeconds / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        const secs = remainingSeconds % 60;

        const hEl = document.getElementById('timerHours');
        const mEl = document.getElementById('timerMins');
        const sEl = document.getElementById('timerSecs');

        if (hEl) hEl.textContent = String(hours).padStart(2, '0');
        if (mEl) mEl.textContent = String(mins).padStart(2, '0');
        if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    }, 1000);
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

        // Also update standard .stat-card .value if present
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
loadDashboardStats();
loadAuditLogs();
startElectionClock();

// Event Listeners
const verifyBtn = document.getElementById('verifyChainBtn');
if (verifyBtn) verifyBtn.onclick = verifyAuditChain;

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
}
