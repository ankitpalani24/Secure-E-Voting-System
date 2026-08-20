function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconEl = document.createElement('i');
    iconEl.style.fontSize = '1.2rem';
    if (type === 'success') {
        iconEl.className = 'fas fa-check-circle';
    } else if (type === 'error') {
        iconEl.className = 'fas fa-exclamation-circle';
    } else {
        iconEl.className = 'fas fa-info-circle';
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = String(message || '');
    
    toast.appendChild(iconEl);
    toast.appendChild(textSpan);
    container.appendChild(toast);
    
    // Remove the toast from DOM after animation completes (3s + 0.3s)
    setTimeout(() => {
        toast.remove();
        if (container && container.children.length === 0) {
            container.remove();
        }
    }, 3300);
}
