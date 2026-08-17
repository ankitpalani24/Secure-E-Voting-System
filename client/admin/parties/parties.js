// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Load parties list from API
async function loadParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const container = document.getElementById('partiesContainer') || document.querySelector('.party-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 32px;"><i class="fas fa-spinner fa-spin"></i> Retrieving accredited party records...</div>';
    
    try {
        const res = await fetch('/api/admin/parties', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        const parties = await res.json();
        container.innerHTML = '';

        if (!Array.isArray(parties) || parties.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-landmark" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 6px;">No Accredited Parties Found</h3>
                    <p style="font-size: 0.9rem; margin-bottom: 18px;">No political party slates have been registered yet.</p>
                    <a href="../register-party/register-party.html" class="btn-primary" style="display: inline-flex;"><i class="fas fa-plus-circle"></i> Register First Party</a>
                </div>
            `;
            return;
        }

        // Render clean candidate/party cards in a grid
        const grid = document.createElement('div');
        grid.className = 'candidates-grid';
        grid.style.marginTop = '0';

        parties.forEach((party) => {
            const card = document.createElement('div');
            card.className = 'kpi-card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.gap = '14px';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="font-size: 2.8rem; line-height: 1;">${party.symbol || '🗳️'}</div>
                    <span class="status-badge live" style="font-size: 0.75rem;"><i class="fas fa-check-circle"></i> Accredited</span>
                </div>
                <div style="width: 100%;">
                    <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 4px; font-weight: 700;">${party.partyName || 'Unknown Party'}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">${party.description || 'No description provided.'}</p>
                    ${party.manifesto ? `<div style="font-size: 0.78rem; color: var(--text-muted); background: var(--surface-muted); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 10px;"><strong>Manifesto:</strong> ${party.manifesto}</div>` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px;">
                        <span><i class="fas fa-user-tie"></i> Rep: <strong>${party.username || 'N/A'}</strong></span>
                        <span style="font-family: monospace;">ID: ${party._id ? party._id.slice(-6).toUpperCase() : 'N/A'}</span>
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });

        container.appendChild(grid);

    } catch (err) {
        console.error('Parties load error:', err);
        container.innerHTML = '<div style="text-align: center; color: var(--danger-text); padding: 32px;"><i class="fas fa-exclamation-triangle"></i> Unable to load political parties. Please try again.</div>';
        showToast('Failed to load parties: ' + err.message, 'error');
    }
}

// Load on ready
loadParties();
