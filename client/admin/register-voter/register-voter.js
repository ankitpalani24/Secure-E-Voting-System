let faceDescriptor = null;
let videoEl = null;
let streamInstance = null;
let detectInterval = null;
let modelsLoaded = false;
let isModelLoading = false;

// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Asynchronously pre-load face models in background without blocking screen
async function ensureModelsLoaded() {
    if (modelsLoaded) return true;
    if (isModelLoading) return false;

    isModelLoading = true;
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('../../models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('../../models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('../../models'),
        ]);
        modelsLoaded = true;
        isModelLoading = false;
        console.log("Facial recognition models loaded successfully.");
        return true;
    } catch (err) {
        console.error("Model loading error:", err);
        isModelLoading = false;
        return false;
    }
}

// Trigger background model loading
ensureModelsLoaded();

// Modal Open & Close Event Listeners
const openFaceModalBtn = document.getElementById('openFaceModalBtn');
const facePopup = document.getElementById('facePopup');
const closePopup = document.getElementById('closePopup');
const closeModalCancelBtn = document.getElementById('closeModalCancelBtn');

if (openFaceModalBtn && facePopup) {
    openFaceModalBtn.onclick = () => {
        facePopup.classList.remove('hidden');
        initFaceCapture();
    };
}

if (closePopup && facePopup) {
    closePopup.onclick = closeFacePopup;
}

if (closeModalCancelBtn && facePopup) {
    closeModalCancelBtn.onclick = closeFacePopup;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && facePopup && !facePopup.classList.contains('hidden')) {
        closeFacePopup();
    }
});

async function initFaceCapture() {
    videoEl = document.getElementById('video');
    const statusEl = document.getElementById('faceStatus');
    const captureBtn = document.getElementById('captureBtn');

    if (!videoEl || !statusEl || !captureBtn) return;

    statusEl.textContent = 'Connecting to camera & AI models...';
    statusEl.style.color = 'var(--warning-text)';
    captureBtn.disabled = true;

    // Ensure models are ready
    if (!modelsLoaded) {
        statusEl.textContent = 'Loading facial AI recognition network...';
        await ensureModelsLoaded();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
        });

        streamInstance = stream;
        videoEl.srcObject = stream;
        
        videoEl.onloadedmetadata = async () => {
            try {
                await videoEl.play();
            } catch (playErr) {
                console.warn("Autoplay notice:", playErr);
            }
            statusEl.textContent = 'Position your face in the center of the frame.';
            statusEl.style.color = 'var(--primary-dark)';
            captureBtn.disabled = false;
            startContinuousFaceDetection();
        };
    } catch (err) {
        console.error("Camera access error:", err);
        statusEl.textContent = 'Camera unavailable or permission denied. Please allow camera access.';
        statusEl.style.color = 'var(--danger-text)';
        captureBtn.disabled = true;
    }
}

function startContinuousFaceDetection() {
    if (detectInterval) clearInterval(detectInterval);

    const statusEl = document.getElementById('faceStatus');
    const captureBtn = document.getElementById('captureBtn');

    detectInterval = setInterval(async () => {
        if (!videoEl || videoEl.paused || videoEl.ended || !modelsLoaded) return;

        try {
            const detection = await faceapi.detectSingleFace(
                videoEl,
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.65 })
            ).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                statusEl.textContent = '✓ High-quality face detected! Ready to capture.';
                statusEl.style.color = 'var(--success-text)';
                if (captureBtn) {
                    captureBtn.className = 'btn-primary';
                    captureBtn.style.backgroundColor = 'var(--success)';
                }
            } else {
                statusEl.textContent = 'Looking for face — please face camera directly.';
                statusEl.style.color = 'var(--warning-text)';
                if (captureBtn) {
                    captureBtn.className = 'btn-primary';
                    captureBtn.style.backgroundColor = 'var(--primary)';
                }
            }
        } catch (e) {
            // Ignore frame glitch
        }
    }, 400);

    // Manual / Active Capture Handler
    if (captureBtn) {
        captureBtn.onclick = async () => {
            captureBtn.disabled = true;
            captureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Signature...';
            statusEl.textContent = 'Extracting 128-dimensional biometric embedding...';
            statusEl.style.color = 'var(--primary-dark)';

            try {
                const detection = await faceapi.detectSingleFace(
                    videoEl,
                    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.50 })
                ).withFaceLandmarks().withFaceDescriptor();

                if (detection && detection.descriptor) {
                    faceDescriptor = Array.from(detection.descriptor);
                    statusEl.textContent = '✓ Biometric profile verified & captured!';
                    statusEl.style.color = 'var(--success-text)';

                    const descriptorStatus = document.getElementById('faceDescriptorStatusText');
                    if (descriptorStatus) {
                        descriptorStatus.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success);"></i> Biometric signature captured (128-d Vector)';
                        descriptorStatus.style.color = 'var(--success-text)';
                    }

                    showToast('Biometric signature captured successfully!', 'success');
                    setTimeout(closeFacePopup, 700);
                } else {
                    statusEl.textContent = '⚠ No clear face found in this snapshot. Please center your face and try again.';
                    statusEl.style.color = 'var(--danger-text)';
                    captureBtn.disabled = false;
                    captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture Face Signature';
                    showToast('Face not detected. Please look directly at the lens.', 'error');
                }
            } catch (err) {
                console.error("Biometric extraction error:", err);
                statusEl.textContent = 'Extraction error: ' + err.message;
                statusEl.style.color = 'var(--danger-text)';
                captureBtn.disabled = false;
                captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture Face Signature';
            }
        };
    }
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

        if (!faceDescriptor || faceDescriptor.length !== 128) {
            showToast("Biometric facial scan is required before citizen registration.", "error");
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

        const submitBtn = document.getElementById('addvoter');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enrolling Citizen...';
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
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Enrollment';
                }
            }
        } catch (err) {
            hideSpinner();
            showToast('Unable to connect to election server: ' + err.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Enrollment';
            }
        }
    });
}
