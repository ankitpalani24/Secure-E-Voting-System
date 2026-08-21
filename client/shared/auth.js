/**
 * SECUREVOTE SHARED CLIENT-SIDE AUTH & NAVIGATION HELPER
 */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function getPortalPrefix() {
    const pathname = window.location.pathname.replace(/\\/g, '/');
    if (pathname.includes('/admin/')) {
        return '../../';
    } else if (pathname.includes('/voter-dashboard/') || pathname.includes('/party-dashboard/') || pathname.includes('/login/')) {
        return '../';
    } else {
        return '';
    }
}

function checkAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const prefix = getPortalPrefix();

    if (!token) {
        window.location.href = prefix ? `${prefix}login/login.html` : 'login/login.html';
        return false;
    }

    if (requiredRole && role && role !== requiredRole) {
        // Redirect to user's authorized portal
        if (role === 'admin') {
            window.location.href = prefix ? `${prefix}admin/dashboard/dashboard.html` : 'admin/dashboard/dashboard.html';
        } else if (role === 'voter') {
            window.location.href = prefix ? `${prefix}voter-dashboard/v-dashboard.html` : 'voter-dashboard/v-dashboard.html';
        } else if (role === 'party') {
            window.location.href = prefix ? `${prefix}party-dashboard/p-parties.html` : 'party-dashboard/p-parties.html';
        } else {
            window.location.href = prefix ? `${prefix}login/login.html` : 'login/login.html';
        }
        return false;
    }

    return true;
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');

    const prefix = getPortalPrefix();
    window.location.href = prefix ? `${prefix}login/login.html` : 'login/login.html';
}

/**
 * Checks if an API response indicates an expired or invalid session (HTTP 401).
 * If so, triggers automatic logout, user notification, and redirect.
 */
function handleAuthResponse(res) {
    if (res && res.status === 401) {
        if (typeof showToast === 'function') {
            showToast('Your session has expired. Please sign in again.', 'error');
        }
        setTimeout(() => {
            handleLogout();
        }, 1200);
        return false;
    }
    return true;
}

// Global Auth helper compatibility wrapper
const Auth = {
    requireAuth: (role) => checkAuth(role),
    getUser: () => ({
        username: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail'),
        role: localStorage.getItem('role'),
        token: localStorage.getItem('token')
    }),
    getToken: () => localStorage.getItem('token'),
    logout: () => handleLogout()
};

// Global Toast helper compatibility wrapper
const Toast = {
    show: (msg, type, dur) => (typeof showToast === 'function' ? showToast(msg, type, dur) : console.log(msg)),
    success: (msg) => (typeof showToast === 'function' ? showToast(msg, 'success') : console.log(msg)),
    error: (msg) => (typeof showToast === 'function' ? showToast(msg, 'error') : console.error(msg)),
    warning: (msg) => (typeof showToast === 'function' ? showToast(msg, 'warning') : console.warn(msg)),
    info: (msg) => (typeof showToast === 'function' ? showToast(msg, 'info') : console.info(msg)),
};

// Attach universal navigation and accessibility listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile menu toggle with Backdrop & Keyboard support
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open', 'active');
        if (backdrop) backdrop.classList.remove('active');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
    };

    const openSidebar = () => {
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
    };

    if (mobileBtn && sidebar) {
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        backdrop.addEventListener('click', closeSidebar);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        });
    }

    // 2. Universal Logout Handlers
    const logoutElements = document.querySelectorAll('.logout-btn, .logout-nav-btn, #sidebarLogoutBtn');
    logoutElements.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    });

    // 3. User Name Badges
    const userName = localStorage.getItem('userName');
    if (userName) {
        const userBadgeEls = document.querySelectorAll('#adminUserName, #voterProfileName, #partyUserName, #userDisplayName');
        userBadgeEls.forEach(el => {
            if (el) el.textContent = userName;
        });
    }
});
