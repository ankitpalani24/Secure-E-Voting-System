let faceDescriptor = null;
let videoEl = null;
let streamInstance = null;
let detectInterval = null;

// Load face-api models
showSpinner("Loading Facial AI Recognition Models...");
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('../../models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('../../models'),
]).then(() => {
    hideSpinner();
}).catch(err => {
    hideSpinner();
    console.error("Face model load error:", err);
});

// Open Face Modal Handler
const openFaceModalBtn = document.getElementById('openFaceModalBtn');
const facePopup = document.getElementById('facePopup');
const closePopup = document.getElementById('closePopup');

if (openFaceModalBtn && facePopup) {
    openFaceModalBtn.onclick = () => {
        facePopup.classList.remove('hidden');
        initFaceCapture();
    };
}

if (closePopup && facePopup) {
    closePopup.onclick = () => {
        closeFacePopup();
    };
}

function initFaceCapture() {
    videoEl = document.getElementById('video');
    const statusEl = document.getElementById('faceStatus');
    const captureBtn = document.getElementById('captureBtn');

    if (!videoEl || !statusEl || !captureBtn) return;

    statusEl.textContent = 'Requesting camera permissions...';
    statusEl.style.color = 'var(--warning-text)';
    captureBtn.disabled = true;

    navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
    }).then(stream => {
        streamInstance = stream;
        videoEl.srcObject = stream;
        videoEl.onloadedmetadata = () => {
            statusEl.textContent = 'Position face within frame and look directly at camera.';
            statusEl.style.color = 'var(--primary)';
            detectFaceLoop();
        };
    }).catch(err => {
        console.error("Camera access error:", err);
        statusEl.textContent = 'Camera permission denied or camera device unavailable.';
        statusEl.style.color = 'var(--danger-text)';
    });
}

function detectFaceLoop() {
    if (detectInterval) clearInterval(detectInterval);

    detectInterval = setInterval(async () => {
        if (!videoEl || videoEl.readyState !== 4) return;

        const detection = await faceapi.detectSingleFace(
            videoEl,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.75 })
        ).withFaceLandmarks().withFaceDescriptor();

        const statusEl = document.getElementById('faceStatus');
        const captureBtn = document.getElementById('captureBtn');
        if (!statusEl || !captureBtn) return;

        if (detection) {
            statusEl.textContent = '✓ High-quality biometric face detected. Ready to capture!';
            statusEl.style.color = 'var(--success-text)';
            captureBtn.disabled = false;
            captureBtn.onclick = () => {
                captureBiometrics(detection.descriptor);
            };
        } else {
            statusEl.textContent = 'Looking for a clear face — adjust lighting and center face in frame.';
            statusEl.style.color = 'var(--warning-text)';
            captureBtn.disabled = true;
        }
    }, 400);
}

function captureBiometrics(descriptor) {
    if (detectInterval) clearInterval(detectInterval);
    faceDescriptor = Array.from(descriptor);

    const statusEl = document.getElementById('faceStatus');
    if (statusEl) {
        statusEl.textContent = '✓ Biometric signature captured!';
        statusEl.style.color = 'var(--success-text)';
    }

    const faceDescriptorStatusText = document.getElementById('faceDescriptorStatusText');
    if (faceDescriptorStatusText) {
        faceDescriptorStatusText.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success);"></i> Biometric vector verified & attached';
        faceDescriptorStatusText.style.color = 'var(--success-text)';
    }

    showToast('Biometric face descriptor captured successfully!', 'success');
    setTimeout(closeFacePopup, 800);
}

function closeFacePopup() {
    if (detectInterval) clearInterval(detectInterval);
    if (facePopup) facePopup.classList.add('hidden');
    if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
        streamInstance = null;
    }
}

// Form Submission
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!faceDescriptor) {
            showToast("Biometric face scan is required before citizen registration!", "error");
            return;
        }

        const fullName = document.getElementById('fullName').value.trim();
        const voterId = document.getElementById('voterId').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!fullName || !email || !password) {
            showToast("Please fill all required citizen fields.", "error");
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Session expired. Please sign in again.', 'error');
            setTimeout(() => window.location.href = '../../login/login.html', 1200);
            return;
        }

        showSpinner("Enrolling citizen and computing cryptographic audit block...");
        try {
            const res = await fetch('/api/admin/add-voter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: fullName,
                    email: email.includes('@') ? email : `${email}@voter`,
                    password,
                    voterId,
                    faceDescriptor
                })
            });

            const data = await res.json();
            hideSpinner();

            if (res.ok) {
                showToast('✓ Citizen enrolled successfully!', 'success');
                registerForm.reset();
                faceDescriptor = null;
                setTimeout(() => window.location.href = '../voters/voters.html', 1000);
            } else {
                showToast(data.message || 'Registration failed.', 'error');
            }
        } catch (err) {
            hideSpinner();
            showToast('Unable to connect to election server: ' + err.message, 'error');
        }
    });
}
