window.showSpinner = function(message = 'Loading...') {
    if (document.getElementById('global-spinner-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'global-spinner-overlay';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner-circle';
    
    const text = document.createElement('div');
    text.id = 'global-spinner-text';
    text.innerText = message;
    
    overlay.appendChild(spinner);
    overlay.appendChild(text);
    
    document.body.appendChild(overlay);
};

window.hideSpinner = function() {
    const overlay = document.getElementById('global-spinner-overlay');
    if (overlay) {
        overlay.remove();
    }
};
