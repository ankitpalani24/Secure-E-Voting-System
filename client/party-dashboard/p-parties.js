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

    try {
        const res = await fetch('/api/party', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const partyList = document.querySelector('.party-list');
        if (!partyList) return;
        partyList.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            partyList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No accredited parties registered in the electoral directory.</p>';
            return;
        }

        data.forEach((party) => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.marginBottom = '12px';

            const contentDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = party.partyName || 'Unknown Party';

            const valueH2 = document.createElement('h2');
            valueH2.className = 'value';
            valueH2.textContent = `${party.symbol || '🗳️'} ${party.description ? '- ' + party.description : ''}`;
            valueH2.style.fontSize = '1.15rem';
            valueH2.style.fontWeight = '500';

            contentDiv.appendChild(labelSpan);
            contentDiv.appendChild(valueH2);

            const iconBox = document.createElement('div');
            iconBox.className = 'icon-box purple';
            const icon = document.createElement('i');
            icon.className = 'fas fa-landmark';
            iconBox.appendChild(icon);

            card.appendChild(contentDiv);
            card.appendChild(iconBox);
            partyList.appendChild(card);
        });
    } catch (err) {
        console.error('Party load error:', err);
    }
}

loadPartyList();
