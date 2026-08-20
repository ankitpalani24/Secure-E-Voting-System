// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Load parties for party representative
async function loadPartyList() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../login/login.html';

    const userName = localStorage.getItem('userName') || 'Party Representative';
    const partyUserEl = document.getElementById('partyUserName');
    if (partyUserEl) partyUserEl.textContent = userName;

    const container = document.getElementById('partyCatalogContainer') || document.querySelector('.party-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 32px;"><i class="fas fa-spinner fa-spin"></i> Retrieving candidate catalog...</div>';

    try {
        const res = await fetch('/api/party', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        container.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-landmark" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 6px;">No Accredited Parties Found</h3>
                    <p style="font-size: 0.9rem;">No political party slates are currently certified for this election.</p>
                </div>
            `;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'candidates-grid';
        grid.style.marginTop = '0';

        data.forEach((party) => {
            const card = document.createElement('div');
            card.className = 'kpi-card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.gap = '14px';

            const cleanSymbol = typeof escapeHtml === 'function' ? escapeHtml(party.symbol || '🗳️') : (party.symbol || '🗳️');
            const cleanName = typeof escapeHtml === 'function' ? escapeHtml(party.partyName || 'Unknown Party') : (party.partyName || 'Unknown Party');
            const cleanDesc = typeof escapeHtml === 'function' ? escapeHtml(party.description || 'Accredited political party slate.') : (party.description || 'Accredited political party slate.');
            const cleanId = party._id ? (typeof escapeHtml === 'function' ? escapeHtml(party._id.slice(-6).toUpperCase()) : party._id.slice(-6).toUpperCase()) : 'N/A';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="font-size: 2.8rem; line-height: 1;">${cleanSymbol}</div>
                    <span class="status-badge live" style="font-size: 0.75rem;"><i class="fas fa-check-circle"></i> Certified</span>
                </div>
                <div style="width: 100%;">
                    <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 4px; font-weight: 700;">${cleanName}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">${cleanDesc}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                        <span><i class="fas fa-shield-alt"></i> Certified Candidate</span>
                        <span style="font-family: monospace;">ID: ${cleanId}</span>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });

        container.appendChild(grid);
    } catch (err) {
        console.error('Party load error:', err);
        container.innerHTML = '<div style="text-align: center; color: var(--danger-text); padding: 32px;"><i class="fas fa-exclamation-triangle"></i> Unable to load party slates. Please try again.</div>';
    }
}

loadPartyList();
