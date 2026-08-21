// Role Tab Switching
const roleTabs = document.querySelectorAll('.role-tab');
const roleInput = document.getElementById('role');
const usernameLabel = document.getElementById('usernameLabel');
const usernameInput = document.getElementById('username');

if (roleTabs.length > 0 && roleInput) {
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const selectedRole = tab.getAttribute('data-role');
            roleInput.value = selectedRole;

            if (selectedRole === 'admin') {
                if (usernameLabel) usernameLabel.textContent = 'Administrator Username / Email';
                if (usernameInput) usernameInput.placeholder = 'e.g. admin';
            } else if (selectedRole === 'party') {
                if (usernameLabel) usernameLabel.textContent = 'Party Representative Username';
                if (usernameInput) usernameInput.placeholder = 'e.g. party_representative';
            } else {
                if (usernameLabel) usernameLabel.textContent = 'Voter ID / Registered Email';
                if (usernameInput) usernameInput.placeholder = 'e.g. voter@domain.com';
            }
        });
    });
}

// Password Visibility Toggle
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const passwordInput = document.getElementById('password');
const togglePasswordIcon = document.getElementById('togglePasswordIcon');

if (togglePasswordBtn && passwordInput && togglePasswordIcon) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
}

// Forgot Password Support
const forgotLink = document.querySelector('.form__forgot');
if (forgotLink) {
    forgotLink.addEventListener('click', () => {
        showToast('Password reset is restricted. Please contact the Electoral Commission.', 'info');
    });
}

// Role-based Secure Login Submission
const loginForm = document.querySelector('.form__content');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;

        if (!username || !password || !role) {
            showToast('Please enter both your credentials and role.', 'error');
            return;
        }

        const submitBtn = document.getElementById('loginSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        }

        try {
            showSpinner("Authenticating Security Credentials...");

            let endpoint;
            if (role === 'admin') endpoint = '/api/auth/admin-login';
            else if (role === 'voter') endpoint = '/api/auth/voter-login';
            else if (role === 'party') endpoint = '/api/auth/party-login';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            hideSpinner();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                localStorage.setItem('userEmail', username);
                localStorage.setItem('userName', data.name || username);

                showToast('Authentication successful. Redirecting...', 'success');

                setTimeout(() => {
                    if (data.role === 'admin' || data.role === 'SUPER_ADMIN' || data.role === 'ELECTION_ADMIN') {
                        window.location.href = '../admin/dashboard/dashboard.html';
                    } else if (data.role === 'AUDITOR') {
                        window.location.href = '../admin/auditor/auditor.html';
                    } else if (data.role === 'voter') {
                        window.location.href = '../voter-dashboard/v-dashboard.html';
                    } else if (data.role === 'party') {
                        window.location.href = '../party-dashboard/p-parties.html';
                    }
                }, 800);
            } else {
                showToast(data.message || 'Authentication failed. Please verify credentials.', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Secure Portal';
                }
            }
        } catch (err) {
            hideSpinner();
            showToast('Unable to connect to election server. Please try again.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Secure Portal';
            }
        }
    });
}
