
const adddiv = document.querySelector(".icon-box.purple");
const addPartyDiv = document.getElementById("addparty");
const cancelBtn = document.querySelector(".btn-secondary");

// Show / Hide on + button click
if (adddiv && addPartyDiv) {
    adddiv.addEventListener("click", function () {
        addPartyDiv.classList.toggle("hidden");
    });
}

// Hide on Cancel button click
if (cancelBtn && addPartyDiv) {
    cancelBtn.addEventListener("click", function () {
        addPartyDiv.classList.add("hidden");
    });
}


// Fetch global stats to update nav tabs
async function updateNavCounts() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const statsRes = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` }});
        if (statsRes.ok) {
            const stats = await statsRes.json();
            const voterTab = document.querySelector('a[href*="/voters/"]');
            if (voterTab) voterTab.innerHTML = '<i class="fas fa-users"></i> Voters (' + stats.votersCount + ')';
            const partyTab = document.querySelector('a[href*="/parties/"]');
            if (partyTab) partyTab.innerHTML = '<i class="fas fa-building"></i> Parties (' + stats.partiesCount + ')';
        }
    } catch (e) {
        console.error("Nav stats load error:", e);
    }
}
updateNavCounts();

// 
const logoutBtn = document.querySelector(".logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("mouseover", () => {
        logoutBtn.style.color = "#ff0000";
        logoutBtn.style.transform = "scale(1.2)";
    });
    logoutBtn.addEventListener("mouseout", () => {
        logoutBtn.style.color = "inherit";
        logoutBtn.style.transform = "scale(1)";
    });
}

// Add symbol selection
document.addEventListener('DOMContentLoaded', function() {
    const symbolBtns = document.querySelectorAll('.symbol-btn');
    const symbolInput = document.getElementById('symbol');
    
    symbolBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            symbolInput.value = this.dataset.symbol;
            symbolBtns.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
});

async function registerParty() {
    const partyName = document.getElementById("partyName").value;
    const symbol = document.getElementById("symbol").value;
    const description = document.getElementById("description").value;
    const manifesto = document.getElementById("manifesto").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!partyName || !symbol || !email || !password || !description || !manifesto) {
        showToast("Please fill all fields!", "error");
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first");
        return;
    }

    try {
        const res = await fetch("/api/admin/add-party", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                partyName,
                symbol,
                description,
                manifesto,
                email,
                username: email,  // backend expects username
                password
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Party registered successfully!', 'success');
            document.getElementById("partyForm").reset();
            document.getElementById("symbol").value = "";
            document.querySelectorAll('.symbol-btn').forEach(btn => btn.classList.remove('selected'));
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        alert("Network error: " + err.message);
    }
}

document.getElementById('partyForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    registerParty();
});
