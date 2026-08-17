// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Global state for voters
let allVoters = [];

// Load voters from API
async function loadVoters() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    const tbody = document.getElementById('votersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;"><i class="fas fa-spinner fa-spin"></i> Retrieving accredited citizen records...</td></tr>';
    }
    
    try {
        const res = await fetch('/api/admin/voters', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        allVoters = await res.json();
        
        // Update badge
        const badge = document.getElementById('voterCountBadge');
        if (badge) badge.textContent = `${allVoters.length} Registered Voters`;

        renderVotersTable(allVoters);
    } catch (err) {
        console.error('Voters load error:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger-text); padding: 32px;"><i class="fas fa-exclamation-triangle"></i> Unable to load voter records. Please try again.</td></tr>';
        }
        showToast('Failed to load voters roll: ' + err.message, 'error');
    }
}

// Render voters array into the table body
function renderVotersTable(votersArray) {
    const tbody = document.getElementById('votersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!Array.isArray(votersArray) || votersArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;"><i class="fas fa-users-slash"></i> No citizen voter records found.</td></tr>';
        return;
    }

    votersArray.forEach(voter => {
        const tr = document.createElement('tr');

        // 1. Citizen Name with Avatar Icon
        const nameTd = document.createElement('td');
        const nameWrap = document.createElement('div');
        nameWrap.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const avatar = document.createElement('div');
        avatar.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; background: var(--primary-subtle); color: var(--primary-dark); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;';
        avatar.textContent = (voter.name || 'V').charAt(0).toUpperCase();

        const nameDetails = document.createElement('div');
        const nameStrong = document.createElement('strong');
        nameStrong.style.cssText = 'display: block; font-size: 0.9rem; color: var(--text-primary);';
        nameStrong.textContent = voter.name || 'Unknown Citizen';

        const subSpan = document.createElement('span');
        subSpan.style.cssText = 'font-size: 0.75rem; color: var(--text-muted);';
        subSpan.textContent = 'Accredited Voter';

        nameDetails.appendChild(nameStrong);
        nameDetails.appendChild(subSpan);
        nameWrap.appendChild(avatar);
        nameWrap.appendChild(nameDetails);
        nameTd.appendChild(nameWrap);

        // 2. Email
        const emailTd = document.createElement('td');
        emailTd.textContent = voter.email || 'N/A';
        emailTd.style.color = 'var(--text-secondary)';

        // 3. Voter ID / Mongo ID Short
        const idTd = document.createElement('td');
        const idShort = voter.voterId || (voter._id ? `VOT-${voter._id.slice(-6).toUpperCase()}` : 'N/A');
        const idSpan = document.createElement('span');
        idSpan.style.cssText = 'font-family: monospace; font-size: 0.82rem; background: var(--surface-muted); padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-weight: 600;';
        idSpan.textContent = idShort;
        idTd.appendChild(idSpan);

        // 4. Biometrics Status
        const bioTd = document.createElement('td');
        bioTd.innerHTML = `<span class="status-badge live" style="font-size: 0.75rem;"><i class="fas fa-check-circle"></i> Enrolled (128-d)</span>`;

        // 5. Participation Status
        const statusTd = document.createElement('td');
        if (voter.hasVoted) {
            statusTd.innerHTML = `<span class="status-badge live"><i class="fas fa-vote-yea"></i> VOTED</span>`;
        } else {
            statusTd.innerHTML = `<span class="status-badge pending"><i class="fas fa-clock"></i> PENDING</span>`;
        }

        tr.appendChild(nameTd);
        tr.appendChild(emailTd);
        tr.appendChild(idTd);
        tr.appendChild(bioTd);
        tr.appendChild(statusTd);

        tbody.appendChild(tr);
    });
}

// Search filter
const searchInput = document.getElementById('voterSearch');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderVotersTable(allVoters);
            return;
        }

        const filtered = allVoters.filter(v => {
            const name = (v.name || '').toLowerCase();
            const email = (v.email || '').toLowerCase();
            const id = (v.voterId || v._id || '').toLowerCase();
            return name.includes(query) || email.includes(query) || id.includes(query);
        });

        renderVotersTable(filtered);
    });
}

// Initial load
loadVoters();
