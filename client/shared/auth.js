/**
 * SECUREVOTE SHARED CLIENT-SIDE AUTH & LAYOUT HELPER
 */

function checkAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    // Calculate relative path to login based on nesting depth
    const pathParts = window.location.pathname.replace(/\\/g, '/').split('/');
    let loginPath = '../login/login.html';
    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/voter-dashboard/') || window.location.pathname.includes('/party-dashboard/')) {
        loginPath = '../../login/login.html';
        if (pathParts.length > 0 && pathParts[pathParts.length - 2] === 'client') {
            loginPath = 'login/login.html';
        }
    }

    if (!token) {
        window.location.href = loginPath;
        return false;
    }

    if (requiredRole && role && role !== requiredRole) {
        // Redirect to user's authorized portal
        if (role === 'admin') window.location.href = '../../admin/dashboard/dashboard.html';
        else if (role === 'voter') window.location.href = '../../voter-dashboard/v-dashboard.html';
        else if (role === 'party') window.location.href = '../../party-dashboard/p-parties.html';
        else window.location.href = loginPath;
        return false;
    }

    return true;
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');

    let loginPath = '../../login/login.html';
    if (window.location.pathname.includes('/login/')) {
        loginPath = 'login.html';
    } else if (window.location.pathname.endsWith('/client/index.html') || window.location.pathname.endsWith('/client/')) {
        loginPath = 'login/login.html';
    }

    window.location.href = loginPath;
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
