/**
 * SECUREVOTE SHARED CLIENT-SIDE AUTH & LAYOUT HELPER
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
    if (res.status === 401) {
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

// Attach event listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile menu toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== mobileBtn) {
                sidebar.classList.remove('open');
            }
        });
    }

    // 2. Universal Logout Handler
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
        const userBadgeEls = document.querySelectorAll('#adminUserName, #voterProfileName, #partyUserName');
        userBadgeEls.forEach(el => {
            if (el) el.textContent = userName;
        });
    }
});
