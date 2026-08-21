/**
 * SecureVote Accessible Toast Notification Engine
 * @param {string} message - Notification text
 * @param {'success'|'error'|'warning'|'info'} [type='info'] - Status category
 * @param {number} [duration=3800] - Duration in ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 3800) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    else if (type === 'error') iconClass = 'fas fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-content">
            <i class="${iconClass}" style="font-size: 1.15rem; flex-shrink: 0;"></i>
            <span>${String(message || '')}</span>
        </div>
        <button type="button" class="toast-close-btn" aria-label="Dismiss notification">
            <i class="fas fa-times"></i>
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    let dismissTimeout = null;

    const dismissToast = () => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
        toast.style.animation = 'toastSlideOut 0.2s cubic-bezier(0.4, 0, 1, 1) forwards';
        setTimeout(() => {
            toast.remove();
            if (container && container.children.length === 0) {
                container.remove();
            }
        }, 220);
    };

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            dismissToast();
        };
    }

    container.appendChild(toast);

    if (duration > 0) {
        dismissTimeout = setTimeout(dismissToast, duration);
    }
}
