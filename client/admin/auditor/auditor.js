// ================== SIDEBAR MOBILE TOGGLE ==================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// ================== LOAD AUDITOR DASHBOARD ==================
async function loadAuditorPortal() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const userName = localStorage.getItem('userName') || 'Auditor Officer';
    const auditorNameEl = document.getElementById('auditorUserName');
    if (auditorNameEl) auditorNameEl.textContent = userName;

    loadHealthProbes();
    loadGovernanceSummary();
    loadAuditorLogs();
    loadAuditorProposals();
}

async function loadHealthProbes() {
    try {
        const [healthRes, readyRes] = await Promise.all([
            fetch('/healthz').catch(() => ({ ok: false })),
            fetch('/readyz').catch(() => ({ ok: false }))
        ]);

        const livenessEl = document.getElementById('livenessStatus');
        const readinessEl = document.getElementById('readinessStatus');

        if (livenessEl) {
            livenessEl.textContent = healthRes.ok ? 'ONLINE' : 'DEGRADED';
            livenessEl.style.color = healthRes.ok ? 'var(--success)' : 'var(--danger)';
        }

        if (readinessEl) {
            readinessEl.textContent = readyRes.ok ? 'CONNECTED' : 'DISCONNECTED';
            readinessEl.style.color = readyRes.ok ? 'var(--success)' : 'var(--danger)';
        }
    } catch (err) {
        console.error('Health probe error:', err);
    }
}

async function loadGovernanceSummary() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/governance/summary', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const countEl = document.getElementById('auditorProposalsCount');
            if (countEl) countEl.textContent = (data.total || 0).toLocaleString();
        }
    } catch (err) {
        console.error('Governance summary error:', err);
    }
}

async function loadAuditorProposals() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/proposals', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const proposals = await res.json();
            const tbody = document.getElementById('auditorProposalsTableBody');
            if (!tbody) return;

            tbody.innerHTML = '';
            if (!Array.isArray(proposals) || proposals.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No operational proposals on record.</td></tr>';
                return;
            }

            proposals.forEach(p => {
                const tr = document.createElement('tr');
                const cleanAction = typeof escapeHtml === 'function' ? escapeHtml(p.action.replace('_', ' ')) : p.action;
                const cleanRequestedBy = typeof escapeHtml === 'function' ? escapeHtml(p.requestedByUsername || 'Admin') : (p.requestedByUsername || 'Admin');
                const cleanApprovedBy = typeof escapeHtml === 'function' ? escapeHtml(p.approvedByUsername || '—') : (p.approvedByUsername || '—');
                const cleanReason = typeof escapeHtml === 'function' ? escapeHtml(p.reason || 'Standard operation') : (p.reason || 'Standard operation');

                tr.innerHTML = `
                    <td><strong>${cleanAction}</strong></td>
                    <td>${cleanRequestedBy}</td>
                    <td>${cleanApprovedBy}</td>
                    <td><span class="status-badge ${p.status === 'EXECUTED' ? 'live' : p.status === 'PENDING' ? 'pending' : 'neutral'}">${p.status}</span></td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${cleanReason}</td>
                    <td style="white-space: nowrap; font-size: 0.8rem;">${new Date(p.createdAt || p.requestedAt).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Proposals load error:', err);
    }
}

async function loadAuditorLogs() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/admin/audit-logs?limit=30', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            const logs = data.logs || [];
            const countEl = document.getElementById('auditorLogCount');
            if (countEl) countEl.textContent = (data.total || logs.length).toLocaleString();

            const tbody = document.getElementById('auditorAuditTableBody');
            if (!tbody) return;

            tbody.innerHTML = '';
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No security audit records found.</td></tr>';
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');

                const timeTd = document.createElement('td');
                timeTd.textContent = log.time ? new Date(log.time).toLocaleTimeString() : 'N/A';
                timeTd.style.whiteSpace = 'nowrap';

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
    } catch (err) {
        console.error('Auditor log fetch error:', err);
    }
}

async function verifyAuditChain() {
    const token = localStorage.getItem('token');
    const banner = document.getElementById('auditorChainVerificationBanner');
    const btn = document.getElementById('auditorVerifyChainBtn');
    if (!banner || !btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating Cryptographic Ledger...';

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
            banner.innerHTML = `<i class="fas fa-check-circle"></i> <strong>✓ Audit Chain Verified:</strong> Validated all ${data.totalRecords || 0} chained SHA-256 blocks sequentially with 0 broken links.`;
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

const verifyBtn = document.getElementById('auditorVerifyChainBtn');
if (verifyBtn) verifyBtn.onclick = verifyAuditChain;

loadAuditorPortal();
