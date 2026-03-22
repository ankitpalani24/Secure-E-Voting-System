/*===== FOCUS =====*/
const inputs = document.querySelectorAll(".form__input")

/*=== Add focus ===*/
function addfocus() {
    let parent = this.parentNode.parentNode
    parent.classList.add("focus")
}

/*=== Remove focus ===*/
function remfocus() {
    let parent = this.parentNode.parentNode
    if (this.value == "") {
        parent.classList.remove("focus")
    }
}

/*=== To call function===*/
inputs.forEach(input => {
    input.addEventListener("focus", addfocus)
    input.addEventListener("blur", remfocus)
})

document.querySelector(".form__forgot").addEventListener("click", function () {
    alert("Please contact the administrator to reset your password.");
});

// Role-based login
document.querySelector('.form__content').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    
    if (!username || !password || !role) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        let endpoint;
        if (role === 'admin') endpoint = '/api/auth/admin-login';
        else if (role === 'voter') endpoint = '/api/auth/voter-login';
        else if (role === 'party') endpoint = '/api/auth/party-login';
        
        const res = await fetch(`${endpoint}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})  // voter uses email, but backend handles
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userEmail', username);
            localStorage.setItem('userName', data.name || username);

            // Role-based redirect
            if (data.role === 'admin') {
                window.location.href = '../admin/dashboard/dashboard.html';
            } else if (data.role === 'voter') {
                window.location.href = '../voter-dashboard/v-dashboard.html';
            } else if (data.role === 'party') {
                window.location.href = '../party-dashboard/p-parties.html';
            }
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Login failed: ' + err.message);
    }
});



