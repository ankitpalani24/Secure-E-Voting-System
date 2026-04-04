const addButton = document.querySelector('.icon-box.green');
const addVoterDiv = document.getElementById('addvoter');
const cancelBtn = document.querySelector(".cancel-btn");

addButton.addEventListener('click', function () {
    addVoterDiv.classList.toggle('hidden');
});

cancelBtn.addEventListener('click', function () {
    addVoterDiv.classList.add('hidden');
    document.getElementById("registerForm").reset();
});

let faceDescriptor = null;

// Load face-api models
showSpinner("Loading AI Models...");
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('../../models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('../../models'),
]).then(() => {
    console.log('Face-api models loaded');
    hideSpinner();
});

document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!faceDescriptor) {
        showToast("Please capture face first!", "error");
        return;
    }

    const fullName = document.getElementById("fullName").value;
    const voterId = document.getElementById("voterId").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const dob = document.getElementById("dob").value;
    const address = document.getElementById("address").value;

    if (!fullName || !voterId || !email || !password || !dob || !address) {
        showToast("Please fill all fields!", "error");
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => window.location.href = '../../login/login.html', 1500);
        return;
    }

    showSpinner("Registering Voter...");
    try {
        const res = await fetch('/api/admin/add-voter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: fullName,
                email: email + '@voter',
                password,
                voterId,
                faceDescriptor: faceDescriptor
            })
        });

        const data = await res.json();
        hideSpinner();

        if (res.ok) {
        showToast('Voter registered with face data!', 'success');
        document.getElementById("registerForm").reset();
        faceDescriptor = null;
        addVoterDiv.classList.add('hidden');
        window.location.href = '../dashboard/dashboard.html';
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast("Network error: " + err.message, "error");
    }
});

// Add face capture button and logic after form - buttonGroup ready check
const buttonGroup = document.querySelector('.button-group');
if (buttonGroup) {
    const faceBtn = document.createElement('button');
    faceBtn.type = 'button';
    faceBtn.className = 'face-btn';
    faceBtn.innerHTML = '<i class="fas fa-camera"></i> Capture Face';
    buttonGroup.appendChild(faceBtn);
    console.log('Face button DOM ready:', faceBtn.innerHTML);

    faceBtn.onclick = function (e) {
        e.preventDefault();
        console.log('Capture Face clicked!');
        initFaceCapture();
    };
} else {
    console.error('Button group not found!');
}

let videoEl, canvasEl;
function initFaceCapture() {
    console.log('initFaceCapture called');
    const facePopup = document.createElement('div');
    facePopup.id = 'facePopup';
    facePopup.innerHTML = `
        <div class="face-modal">
            <div class="face-header">
                <h3>Scan Face</h3>
                <button onclick="closeFacePopup()" class="close-btn">×</button>
            </div>
            <video id="video" width="320" height="240" autoplay muted style="transform: scaleX(-1);"></video>
            <canvas id="canvas" style="display:none;"></canvas>
            <div id="faceStatus">Loading camera...</div>
            <button id="captureBtn" disabled>✅ Capture Face</button>
        </div>
    `;
    document.body.appendChild(facePopup);
    facePopup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;';

    // Wait for elements
    setTimeout(() => {
        videoEl = document.getElementById('video');
        canvasEl = document.getElementById('canvas');
        console.log('Elements ready', !!videoEl, !!canvasEl);
        document.getElementById('faceStatus').textContent = 'Requesting camera...';

        navigator.mediaDevices.getUserMedia({
            video: {
                width: 320,
                height: 240
            }
        }).then(stream => {
            console.log('Camera granted');
            videoEl.srcObject = stream;
            videoEl.onloadeddata = () => {
                console.log('Video data loaded');
            };
            videoEl.onloadedmetadata = () => {
                console.log('Video metadata loaded, readyState:', videoEl.readyState);
                detectFaces();
            };
        }).catch(err => {
            console.error('Camera error:', err);
            document.getElementById('faceStatus').textContent = 'Camera error: ' + err.message;
        });
    }, 200);
}

function detectFaces() {
    console.log('Detect faces interval started');
    setInterval(async () => {
        if (videoEl.readyState === 4) {
            console.log('Video ready, detecting...');
            const detections = await faceapi.detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 })).withFaceLandmarks().withFaceDescriptor();
            const statusEl = document.getElementById('faceStatus');
            const captureBtn = document.getElementById('captureBtn');

            if (detections) {
                statusEl.textContent = 'High-quality face detected! Ready to capture.';
                statusEl.style.color = 'green';
                captureBtn.disabled = false;
                captureBtn.onclick = () => captureFace(detections.descriptor);
                console.log('Face found!');
            } else {
                statusEl.textContent = 'Looking for a clear face (adjust lighting/position).';
                statusEl.style.color = 'orange';
                captureBtn.disabled = true;
            }
        }
    }, 500);
}

function captureFace(descriptor) {
    console.log('Capturing face, descriptor length:', descriptor.length);
    faceDescriptor = Array.from(descriptor);
    document.getElementById('faceStatus').textContent = 'Face captured successfully!';
    setTimeout(closeFacePopup, 1000);
}

function closeFacePopup() {
    const popup = document.getElementById('facePopup');
    if (popup) popup.remove();
    if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
    }
}

// Fetch global stats to update nav tabs
async function updateNavCounts() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const statsRes = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
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

const logoutBtn = document.querySelector(".logout-btn");
logoutBtn.addEventListener("mouseover", () => {
    logoutBtn.style.color = "#ff0000";
    logoutBtn.style.transform = "scale(1.2)";
});
logoutBtn.addEventListener("mouseout", () => {
    logoutBtn.style.color = "inherit";
    logoutBtn.style.transform = "scale(1)";
});

const statGrid = document.querySelector(".stats-grid");
statGrid.addEventListener("mouseover", () => {
    statGrid.style.transform = "scale(1.05)";
});
statGrid.addEventListener("mouseout", () => {
    statGrid.style.transform = "scale(1)";
});
