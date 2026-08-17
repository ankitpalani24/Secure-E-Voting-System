// Symbol Button Click Handler
const symbolInput = document.getElementById('symbol');
const symbolBtns = document.querySelectorAll('.symbol-btn');

if (symbolBtns.length > 0 && symbolInput) {
    symbolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            symbolBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            symbolInput.value = btn.getAttribute('data-symbol') || btn.textContent.trim();
        });
    });
}

// Form Submission
const partyForm = document.getElementById('partyForm');
if (partyForm) {
    partyForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const partyName = document.getElementById('partyName').value.trim();
        const symbol = document.getElementById('symbol').value.trim();
        const description = document.getElementById('description').value.trim();
        const manifesto = document.getElementById('manifesto').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!partyName || !symbol || !username || !password) {
            showToast("Please fill all required party registration fields.", "error");
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Session expired. Please sign in again.', 'error');
            setTimeout(() => window.location.href = '../../login/login.html', 1200);
            return;
        }

        const addBtn = document.getElementById('addparty');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        }

        showSpinner("Accrediting Political Party & Signing Audit Block...");
        try {
            const res = await fetch('/api/admin/add-party', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    partyName,
                    symbol,
                    description,
                    manifesto,
                    username,
                    password
                })
            });

            const data = await res.json();
            hideSpinner();

            if (res.ok) {
                showToast('✓ Political party accredited successfully!', 'success');
                partyForm.reset();
                setTimeout(() => window.location.href = '../parties/parties.html', 1000);
            } else {
                showToast(data.message || 'Party registration failed.', 'error');
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.innerHTML = '<i class="fas fa-check-circle"></i> Accredit & Register Party';
                }
            }
        } catch (err) {
            hideSpinner();
            showToast('Unable to connect to election server: ' + err.message, 'error');
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.innerHTML = '<i class="fas fa-check-circle"></i> Accredit & Register Party';
            }
        }
    });
}
