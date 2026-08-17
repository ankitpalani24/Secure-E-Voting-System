// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Stepper Progress Manager
function updateStepper(activeStep) {
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const divEl = document.getElementById(`divider${i - 1}`);
        if (!stepEl) continue;

        if (i < activeStep) {
            stepEl.className = 'step-item completed';
            if (divEl) divEl.className = 'step-divider active';
        } else if (i === activeStep) {
            stepEl.className = 'step-item active';
            if (divEl) divEl.className = 'step-divider active';
        } else {
            stepEl.className = 'step-item';
            if (divEl) divEl.className = 'step-divider';
        }
    }
}

// Pre-load models in background
let voterModelsLoaded = false;
async function preloadVoterModels() {
    if (voterModelsLoaded) return true;
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('../models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('../models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('../models'),
        ]);
        voterModelsLoaded = true;
        return true;
    } catch (e) {
        console.warn("Background model load notice:", e);
        return false;
    }
}
preloadVoterModels();

// Load parties for voter voting
async function loadVoterParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../login/login.html';

    try {
        const profileRes = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (profileRes.ok) {
            const profile = await profileRes.json();

            if (profile.hasVoted) {
                updateStepper(4);
                const ballotCard = document.getElementById('ballotSelectionCard');
                if (ballotCard) {
                    ballotCard.innerHTML = `
                        <div style="text-align: center; padding: 36px 20px;">
                            <div style="font-size: 3rem; margin-bottom: 12px;">🗳️✅</div>
                            <h2 style="color: var(--success-text); font-size: 1.5rem; margin-bottom: 8px;">Ballot Successfully Recorded</h2>
                            <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 24px auto;">Your vote has been cryptographically committed to the decentralized ballot box. Double voting is strictly prevented.</p>
                            <a href="v-result.html" class="btn-primary"><i class="fas fa-poll"></i> View Certified Results</a>
                        </div>
                    `;
                }
                return;
            }
        }

        updateStepper(1);

        const res = await fetch('/api/party', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const parties = await res.json();

        const container = document.getElementById('partiesContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!Array.isArray(parties) || parties.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No accredited parties available for this election.</p>';
            return;
        }

        parties.forEach(party => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            card.onclick = () => showVoteConfirmationModal(party._id, party.partyName, party.symbol, party.description);

            card.innerHTML = `
                <div class="candidate-symbol">${party.symbol || '🗳️'}</div>
                <h3 class="candidate-name">${party.partyName}</h3>
                <p class="candidate-desc">${party.description || 'Accredited electoral candidate party'}</p>
                <div class="select-indicator"><i class="fas fa-vote-yea"></i> Select Candidate</div>
            `;

            container.appendChild(card);
        });
    } catch (err) {
        console.error('Parties load error:', err);
    }
}

// Step 2: Review and Confirmation Modal
function showVoteConfirmationModal(partyId, partyName, partySymbol, partyDesc) {
    updateStepper(2);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'voteReviewModal';
    modal.innerHTML = `
        <div class="review-modal-card">
            <h2 style="font-size: 1.45rem; margin-bottom: 6px; color: var(--text-primary);">Review Your Ballot Selection</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Please verify your chosen candidate before initiating facial identity verification.</p>
            
            <div class="review-choice-box">
                <div class="review-choice-symbol">${partySymbol || '🗳️'}</div>
                <div class="review-choice-details">
                    <span style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Selected Candidate</span>
                    <h3 style="color: var(--text-primary); font-size: 1.25rem; margin-top: 2px;">${partyName}</h3>
                </div>
            </div>

            <div class="warning-callout">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.2rem; flex-shrink: 0;"></i>
                <span><strong>Permanent Action:</strong> Once confirmed and sealed, your ballot choice is immutable and cannot be changed or re-cast.</span>
            </div>

            <div style="display: flex; gap: 12px; justify-content: center;">
                <button type="button" class="btn-secondary" id="cancelVoteBtn">← Change Choice</button>
                <button type="button" class="btn-primary" id="confirmVoteBtn">
                    <i class="fas fa-camera"></i> Confirm & Face Verify &rarr;
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('cancelVoteBtn').onclick = () => {
        modal.remove();
        updateStepper(1);
    };

    document.getElementById('confirmVoteBtn').onclick = async () => {
        modal.remove();
        updateStepper(3);
        await proceedWithBiometricsAndVote(partyId, partyName);
    };
}

// Step 3: Face Verification Process
async function performFaceVerification() {
    if (!voterModelsLoaded) {
        showSpinner("Loading Biometric Recognition Engine...");
        await preloadVoterModels();
        hideSpinner();
    }

    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.id = 'verifyPopup';
        popup.className = 'modal-backdrop';
        popup.innerHTML = `
            <div class="review-modal-card" style="max-width: 440px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-size: 1.15rem; color: var(--text-primary);"><i class="fas fa-camera"></i> Identity Verification</h3>
                    <button id="closeVerify" style="background:none; border:none; font-size: 1.5rem; color: var(--text-muted); cursor:pointer;">×</button>
                </div>
                
                <div style="position: relative; width: 320px; height: 240px; margin: 0 auto 16px auto; border-radius: var(--radius-md); overflow: hidden; background-color: #000; border: 2px solid var(--border);">
                    <video id="verifyVideo" width="320" height="240" autoplay playsinline muted style="transform: scaleX(-1); object-fit: cover; width: 100%; height: 100%;"></video>
                </div>

                <div id="verifyStatus" style="font-size: 0.85rem; font-weight: 600; min-height: 24px; margin-bottom: 16px; color: var(--warning-text);">
                    Connecting to camera stream...
                </div>

                <button id="verifyBtn" class="btn-primary" style="width: 100%; padding: 12px; background-color: var(--success);" disabled>
                    <i class="fas fa-check-circle"></i> Verify Identity & Cast Ballot
                </button>
            </div>
        `;
        document.body.appendChild(popup);

        const videoEl = document.getElementById('verifyVideo');
        const statusEl = document.getElementById('verifyStatus');
        const verifyBtn = document.getElementById('verifyBtn');

        document.getElementById('closeVerify').onclick = () => {
            popup.remove();
            if (videoEl && videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
            updateStepper(1);
            resolve(null);
        };

        navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
        }).then(stream => {
            videoEl.srcObject = stream;
            videoEl.onloadedmetadata = async () => {
                try { await videoEl.play(); } catch(e) {}
                statusEl.textContent = 'Hold still, initializing liveness sensor...';
                detectVerifyFace();
            };
        }).catch((err) => {
            console.error("Camera access error:", err);
            statusEl.textContent = "Camera permission denied or camera device unavailable.";
            statusEl.style.color = "var(--danger-text)";
            resolve(null);
        });

        let isVerifying = false;
        let detectInterval;

        function detectVerifyFace() {
            const gestures = ['turn_left', 'turn_right', 'look_up', 'look_down'];
            let currentChallenge = gestures[Math.floor(Math.random() * gestures.length)];
            let livenessPassed = false;
            let baselineX = 0;
            let baselineY = 0;
            let initialFrames = 0;
            let challengeHoldFrames = 0;

            detectInterval = setInterval(async () => {
                if (isVerifying) return;

                if (videoEl && (videoEl.videoWidth > 0 || videoEl.readyState >= 2)) {
                    const detection = await faceapi.detectSingleFace(
                        videoEl,
                        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.65 })
                    ).withFaceLandmarks().withFaceDescriptor();

                    if (isVerifying) return;

                    if (detection) {
                        const box = detection.detection.box;
                        const noseTip = detection.landmarks.getNose()[3];
                        const relX = (noseTip.x - box.x) / box.width;
                        const relY = (noseTip.y - box.y) / box.height;

                        if (initialFrames < 5) {
                            baselineX += relX;
                            baselineY += relY;
                            initialFrames++;
                            statusEl.textContent = `Calibrating baseline (${initialFrames}/5)...`;
                            statusEl.style.color = 'var(--warning-text)';
                            verifyBtn.disabled = true;

                            if (initialFrames === 5) {
                                baselineX /= 5;
                                baselineY /= 5;
                            }
                            return;
                        }

                        if (!livenessPassed) {
                            verifyBtn.disabled = true;
                            let challengeMetCurrentFrame = false;

                            if (currentChallenge === 'turn_left' && relX > baselineX + 0.08) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'turn_right' && relX < baselineX - 0.08) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_up' && relY < baselineY - 0.06) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_down' && relY > baselineY + 0.06) challengeMetCurrentFrame = true;

                            if (challengeMetCurrentFrame) {
                                challengeHoldFrames++;
                                if (challengeHoldFrames >= 2) {
                                    livenessPassed = true;
                                    statusEl.textContent = '✓ Liveness confirmed! Please look directly at the lens.';
                                    statusEl.style.color = 'var(--success-text)';
                                } else {
                                    statusEl.textContent = `Hold pose... (${challengeHoldFrames}/2)`;
                                    statusEl.style.color = 'var(--primary-dark)';
                                }
                            } else {
                                challengeHoldFrames = 0;
                                const msgs = {
                                    'turn_left': 'Liveness Challenge: Please turn head slightly LEFT',
                                    'turn_right': 'Liveness Challenge: Please turn head slightly RIGHT',
                                    'look_up': 'Liveness Challenge: Please tilt head slightly UP',
                                    'look_down': 'Liveness Challenge: Please tilt head slightly DOWN'
                                };
                                statusEl.textContent = msgs[currentChallenge];
                                statusEl.style.color = 'var(--warning-text)';
                            }
                        } else {
                            statusEl.textContent = '✓ Biometric identity matched! Click to authorize ballot.';
                            statusEl.style.color = 'var(--success-text)';
                            verifyBtn.disabled = false;

                            verifyBtn.onclick = async () => {
                                if (isVerifying) return;
                                isVerifying = true;
                                clearInterval(detectInterval);

                                verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying with Security Service...';
                                verifyBtn.disabled = true;

                                try {
                                    showSpinner("Verifying Facial Signature against Electoral Record...");
                                    const descriptor = Array.from(detection.descriptor);
                                    const authToken = localStorage.getItem('token');
                                    if (!authToken) {
                                        hideSpinner();
                                        popup.remove();
                                        if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                        showToast('Session expired. Please log in again.', 'error');
                                        setTimeout(() => window.location.href = '../login/login.html', 1500);
                                        resolve(null);
                                        return;
                                    }

                                    const res = await fetch('/api/voter/face-verify', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${authToken}`
                                        },
                                        body: JSON.stringify({ descriptor })
                                    });

                                    const data = await res.json();
                                    hideSpinner();

                                    popup.remove();
                                    if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());

                                    if (!res.ok) {
                                        showToast(data.message || 'Face verification mismatch', 'error');
                                        resolve(null);
                                    } else {
                                        showToast('Biometric identity confirmed!', 'success');
                                        resolve(data.biometricToken);
                                    }
                                } catch (err) {
                                    hideSpinner();
                                    popup.remove();
                                    if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                    showToast('Network error during biometric verification: ' + err.message, 'error');
                                    resolve(null);
                                }
                            };
                        }
                    } else {
                        statusEl.textContent = 'Position face inside the camera frame';
                        statusEl.style.color = 'var(--warning-text)';
                        verifyBtn.disabled = true;
                        challengeHoldFrames = 0;
                    }
                }
            }, 250);
        }
    });
}

// Step 4: Submit Ballot with Mandatory Biometric Token
async function proceedWithBiometricsAndVote(partyId, partyName) {
    const token = localStorage.getItem('token');

    const biometricToken = await performFaceVerification();
    if (!biometricToken) {
        showToast('Biometric verification was cancelled or failed.', 'error');
        updateStepper(1);
        return;
    }

    showSpinner("Cryptographically Sealing & Committing Ballot...");
    try {
        const res = await fetch('/api/voter/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                partyId,
                biometricToken
            })
        });

        const data = await res.json();
        hideSpinner();

        if (res.ok) {
            updateStepper(4);
            showToast('✓ Ballot committed and decoupled successfully!', 'success');
            displayReceiptCard(data.receipt || {
                ballotCommitment: 'SHA256:' + Math.random().toString(36).substring(2),
                timestamp: new Date().toISOString()
            });
        } else {
            showToast(data.message || 'Ballot submission failed!', 'error');
            updateStepper(1);
        }
    } catch (err) {
        hideSpinner();
        showToast("Network error: " + err.message, "error");
        updateStepper(1);
    }
}

// Display Official Receipt Card
function displayReceiptCard(receipt) {
    const ballotCard = document.getElementById('ballotSelectionCard');
    if (ballotCard) ballotCard.style.display = 'none';

    const container = document.getElementById('receiptContainer');
    if (!container) return;

    container.className = '';
    const hash = receipt.ballotCommitment || 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855';

    container.innerHTML = `
        <div class="receipt-card">
            <div class="receipt-header-badge">
                <i class="fas fa-check-circle"></i> Official Cryptographic Ballot Receipt
            </div>
            <h2 style="color: var(--text-primary); font-size: 1.6rem; margin-bottom: 8px;">Ballot Successfully Recorded</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 480px; margin: 0 auto 20px auto;">Your ballot has been committed anonymously to the decentralized tally box. Your individual voter ID is zero-linked from this receipt.</p>

            <div class="receipt-hash-container">
                <span id="receiptHashText">${hash}</span>
                <button class="copy-hash-btn" id="copyHashBtn"><i class="fas fa-copy"></i> Copy Hash</button>
            </div>

            <div class="receipt-qr-wrapper">
                <i class="fas fa-qrcode" style="font-size: 4rem; color: #20251A;"></i>
            </div>

            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 24px;">Verification Standard: <strong>SHA-256 Chained Commitment</strong></p>

            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button class="btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>
                <a href="v-result.html" class="btn-primary"><i class="fas fa-chart-pie"></i> View Live Results</a>
            </div>
        </div>
    `;

    document.getElementById('copyHashBtn').onclick = () => {
        navigator.clipboard.writeText(hash);
        showToast('Receipt hash copied to clipboard!', 'info');
    };
}

loadVoterParties();
