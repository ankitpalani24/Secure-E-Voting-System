function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>';
    else if (type === 'error') icon = '<i class="fas fa-exclamation-circle" style="font-size: 1.2rem;"></i>';
    else icon = '<i class="fas fa-info-circle" style="font-size: 1.2rem;"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    // Remove the toast from DOM after animation completes (3s + 0.3s)
    setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
            container.remove();
        }
    }, 3300);
}
