// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const appSidebar = document.getElementById('appSidebar');
if (mobileMenuBtn && appSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        appSidebar.classList.toggle('open');
    });
}

// Global Voting State
let selectedParty = null;
let activeCameraStream = null;
let voterModelsLoaded = false;
let faceDetectionInterval = null;
let activeDescriptor = null;

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

// Background Model Preload
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
        console.warn("Background face-api load notice:", e);
        return false;
    }
}
preloadVoterModels();

// Clean up camera stream and timers
function stopCameraStream() {
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    if (activeCameraStream) {
        activeCameraStream.getTracks().forEach(track => track.stop());
        activeCameraStream = null;
    }
    const videoEl = document.getElementById('voterVideo');
    if (videoEl) videoEl.srcObject = null;
}

// Show Step Pane Helper
function showPane(paneId) {
    const panes = ['ballotSelectionCard', 'stepReviewCard', 'stepBiometricCard', 'receiptContainer'];
    panes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === paneId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

// Step 1: Load Accredited Parties
async function loadVoterParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../login/login.html';

    const voterName = localStorage.getItem('userName');
    const nameEl = document.getElementById('voterProfileName');
    if (nameEl && voterName) nameEl.textContent = voterName;

    try {
        const profileRes = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (profileRes.ok) {
            const profile = await profileRes.json();
            if (profile.hasVoted) {
                renderAlreadyVotedState();
                return;
            }
        }

        updateStepper(1);
        showPane('ballotSelectionCard');

        const res = await fetch('/api/party', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const parties = await res.json();

        const container = document.getElementById('partiesContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!Array.isArray(parties) || parties.length === 0) {
            container.innerHTML = `
                <div class="empty-state-box" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon"><i class="fas fa-landmark"></i></div>
                    <div class="empty-state-title">No Accredited Candidates Available</div>
                    <p class="empty-state-text">There are currently no active political party slates registered for this election window.</p>
                </div>
            `;
            return;
        }

        parties.forEach(party => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            card.setAttribute('role', 'radio');
            card.setAttribute('aria-checked', 'false');
            card.setAttribute('tabindex', '0');

            const cleanSymbol = typeof escapeHtml === 'function' ? escapeHtml(party.symbol || '🗳️') : (party.symbol || '🗳️');
            const cleanName = typeof escapeHtml === 'function' ? escapeHtml(party.partyName || 'Unknown Party') : (party.partyName || 'Unknown Party');
            const cleanDesc = typeof escapeHtml === 'function' ? escapeHtml(party.description || 'Accredited candidate slate') : (party.description || 'Accredited candidate slate');

            card.innerHTML = `
                <div class="candidate-symbol">${cleanSymbol}</div>
                <h3 class="candidate-name">${cleanName}</h3>
                <p class="candidate-desc">${cleanDesc}</p>
                <div class="select-indicator"><i class="fas fa-circle"></i> Select Candidate</div>
            `;

            const selectThisCandidate = () => {
                document.querySelectorAll('.candidate-card').forEach(c => {
                    c.classList.remove('selected');
                    c.setAttribute('aria-checked', 'false');
                    const indicator = c.querySelector('.select-indicator');
                    if (indicator) indicator.innerHTML = '<i class="fas fa-circle"></i> Select Candidate';
                });

                card.classList.add('selected');
                card.setAttribute('aria-checked', 'true');
                const activeIndicator = card.querySelector('.select-indicator');
                if (activeIndicator) activeIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Selected Choice';

                selectedParty = {
                    id: party._id,
                    name: party.partyName,
                    symbol: party.symbol,
                    description: party.description,
                };

                const continueBtn = document.getElementById('continueToReviewBtn');
                const promptEl = document.getElementById('selectionPrompt');
                if (continueBtn) continueBtn.disabled = false;
                if (promptEl) promptEl.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fas fa-check"></i> Selected: ${cleanName}</span>`;
            };

            card.onclick = selectThisCandidate;
            card.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectThisCandidate();
                }
            };

            container.appendChild(card);
        });
    } catch (err) {
        console.error('Parties load error:', err);
        showToast('Failed to load candidate slates: ' + err.message, 'error');
    }
}

// Render "Already Voted" Screen
function renderAlreadyVotedState() {
    updateStepper(4);
    const ballotCard = document.getElementById('ballotSelectionCard');
    if (ballotCard) {
        ballotCard.innerHTML = `
            <div class="empty-state-box" style="padding: 48px 20px;">
                <div class="empty-state-icon" style="color: var(--success);"><i class="fas fa-check-circle"></i></div>
                <h2 class="empty-state-title" style="font-size: 1.5rem; margin-bottom: 8px;">Ballot Successfully Recorded</h2>
                <p class="empty-state-text">Your vote has been cryptographically committed to the decentralized ballot box. Double voting is strictly prevented by server-side constraints.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <a href="v-dashboard.html" class="btn-secondary"><i class="fas fa-id-card"></i> Voter Dashboard</a>
                    <a href="v-result.html" class="btn-primary"><i class="fas fa-poll"></i> View Live Results</a>
                </div>
            </div>
        `;
    }
}

// Step 1 $\rightarrow$ Step 2: Continue to Review
const continueToReviewBtn = document.getElementById('continueToReviewBtn');
if (continueToReviewBtn) {
    continueToReviewBtn.onclick = () => {
        if (!selectedParty) return showToast('Please select a candidate slate first.', 'warning');
        updateStepper(2);
        showPane('stepReviewCard');

        const symEl = document.getElementById('reviewChoiceSymbol');
        const nameEl = document.getElementById('reviewChoiceName');
        const descEl = document.getElementById('reviewChoiceDesc');

        if (symEl) symEl.textContent = selectedParty.symbol || '🗳️';
        if (nameEl) nameEl.textContent = selectedParty.name || 'Unknown Party';
        if (descEl) descEl.textContent = selectedParty.description || 'Accredited electoral candidate slate';
    };
}

// Step 2 $\rightarrow$ Step 1: Change Selection
const changeSelectionBtn = document.getElementById('changeSelectionBtn');
if (changeSelectionBtn) {
    changeSelectionBtn.onclick = () => {
        updateStepper(1);
        showPane('ballotSelectionCard');
    };
}

// Step 2 $\rightarrow$ Step 3: Proceed to Biometric Chamber
const proceedToBiometricsBtn = document.getElementById('proceedToBiometricsBtn');
if (proceedToBiometricsBtn) {
    proceedToBiometricsBtn.onclick = async () => {
        if (!selectedParty) return;
        updateStepper(3);
        showPane('stepBiometricCard');
        await initializeBiometricChamber();
    };
}

// Step 3 $\rightarrow$ Step 2: Cancel Biometrics
const cancelBiometricsBtn = document.getElementById('cancelBiometricsBtn');
if (cancelBiometricsBtn) {
    cancelBiometricsBtn.onclick = () => {
        stopCameraStream();
        updateStepper(2);
        showPane('stepReviewCard');
    };
}

// Step 3: Camera & Face Detection Engine
async function initializeBiometricChamber() {
    const videoEl = document.getElementById('voterVideo');
    const statusBadge = document.getElementById('biometricStatusBadge');
    const captureBtn = document.getElementById('captureAndVoteBtn');
    const faceGuide = document.getElementById('faceGuideOval');

    if (captureBtn) captureBtn.disabled = true;
    if (faceGuide) faceGuide.classList.remove('detected');

    if (!voterModelsLoaded) {
        if (statusBadge) {
            statusBadge.className = 'biometric-status-pill detecting';
            statusBadge.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading Neural Face Recognition Models...';
        }
        await preloadVoterModels();
    }

    if (statusBadge) {
        statusBadge.className = 'biometric-status-pill detecting';
        statusBadge.innerHTML = '<i class="fas fa-video"></i> Connecting to Secure Camera Stream...';
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
        });
        activeCameraStream = stream;
        if (videoEl) videoEl.srcObject = stream;

        if (statusBadge) {
            statusBadge.className = 'biometric-status-pill detecting';
            statusBadge.innerHTML = '<i class="fas fa-crosshairs"></i> Align your face within the oval guide';
        }

        // Run continuous face detection loop
        faceDetectionInterval = setInterval(async () => {
            if (!videoEl || videoEl.paused || videoEl.ended || !voterModelsLoaded) return;

            try {
                const detection = await faceapi.detectSingleFace(videoEl)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    activeDescriptor = Array.from(detection.descriptor);
                    if (faceGuide) faceGuide.classList.add('detected');
                    if (statusBadge) {
                        statusBadge.className = 'biometric-status-pill success';
                        statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Face Aligned — Ready to Commit';
                    }
                    if (captureBtn) captureBtn.disabled = false;
                } else {
                    activeDescriptor = null;
                    if (faceGuide) faceGuide.classList.remove('detected');
                    if (statusBadge) {
                        statusBadge.className = 'biometric-status-pill detecting';
                        statusBadge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Searching for face... Center your head';
                    }
                    if (captureBtn) captureBtn.disabled = true;
                }
            } catch (detErr) {
                // Ignore transient frame errors
            }
        }, 500);

    } catch (camErr) {
        console.error('Camera access error:', camErr);
        if (statusBadge) {
            statusBadge.className = 'biometric-status-pill error';
            statusBadge.innerHTML = '<i class="fas fa-video-slash"></i> Camera access denied or unavailable';
        }
        showToast('Camera stream could not be accessed. Please ensure HTTPS and camera permissions are granted.', 'error', 6000);
    }
}

// Step 3 $\rightarrow$ Step 4: Capture, Verify & Cast Ballot
const captureAndVoteBtn = document.getElementById('captureAndVoteBtn');
if (captureAndVoteBtn) {
    captureAndVoteBtn.onclick = async () => {
        if (!selectedParty || !activeDescriptor) {
            return showToast('Face descriptor not detected. Please remain steady in front of the camera.', 'warning');
        }

        const token = localStorage.getItem('token');
        if (!token) return window.location.href = '../login/login.html';

        captureAndVoteBtn.disabled = true;
        captureAndVoteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying & Sealing Ballot...';

        try {
            // 1. Biometric verification step
            const verifyRes = await fetch('/api/voter/face-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ faceDescriptor: activeDescriptor }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                captureAndVoteBtn.disabled = false;
                captureAndVoteBtn.innerHTML = '<i class="fas fa-check-circle"></i> Retry Verification';
                showToast(verifyData.message || 'Biometric identity mismatch. Verification rejected.', 'error');
                return;
            }

            // 2. Ballot commit step using issued biometricToken
            const voteRes = await fetch('/api/voter/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    partyId: selectedParty.id,
                    biometricToken: verifyData.biometricToken,
                }),
            });

            const voteData = await voteRes.json();

            if (voteRes.ok) {
                stopCameraStream();
                updateStepper(4);
                showPane('receiptContainer');
                renderBallotReceipt(voteData.receipt || voteData);
                showToast('Ballot successfully sealed and cryptographically committed!', 'success');
            } else {
                captureAndVoteBtn.disabled = false;
                captureAndVoteBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify & Commit Ballot';
                showToast(voteData.message || 'Ballot submission failed. Please try again.', 'error');
            }
        } catch (err) {
            console.error('Vote submission error:', err);
            captureAndVoteBtn.disabled = false;
            captureAndVoteBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify & Commit Ballot';
            showToast('Network error during ballot submission: ' + err.message, 'error');
        }
    };
}

// Step 4: Render Cryptographic Receipt
function renderBallotReceipt(receipt) {
    const container = document.getElementById('receiptContainer');
    if (!container) return;

    const commitmentHash = receipt.ballotCommitmentHash || receipt.ballotId || '0000-COMMITMENT-HASH-ANONYMOUS';
    const timestamp = receipt.timestamp ? new Date(receipt.timestamp).toLocaleString() : new Date().toLocaleString();

    container.innerHTML = `
        <div class="receipt-card" style="animation: modalFadeIn 0.3s ease-out;">
            <div class="receipt-header-badge">
                <i class="fas fa-shield-alt"></i> Certified Decentralized Ballot Commitment
            </div>
            
            <div style="font-size: 3.5rem; color: var(--success); margin-bottom: 8px;">
                <i class="fas fa-check-circle"></i>
            </div>

            <h2 style="font-size: 1.5rem; color: var(--text-primary); margin-bottom: 4px;">Ballot Successfully Committed</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 460px; margin: 0 auto 20px auto;">
                Your vote choice has been decoupled and deposited into the anonymous ballot repository. Double-voting is mathematically prevented.
            </p>

            <!-- Receipt Metadata Block -->
            <div style="background-color: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px; text-align: left; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 0.85rem;">
                    <span style="color: var(--text-muted); font-weight: 600;">Status</span>
                    <span style="color: var(--success); font-weight: 700;"><i class="fas fa-lock"></i> Sealed & Committed</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 0.85rem;">
                    <span style="color: var(--text-muted); font-weight: 600;">Recorded Timestamp</span>
                    <span style="color: var(--text-primary);">${timestamp}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.85rem;">
                    <span style="color: var(--text-muted); font-weight: 600;">Verification Method</span>
                    <span style="color: var(--text-primary);"><i class="fas fa-user-check"></i> Facial Biometric Token</span>
                </div>
            </div>

            <!-- Hash Container with 1-Click Copy -->
            <div style="text-align: left; margin-bottom: 20px;">
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Cryptographic Ballot Commitment Hash</label>
                <div class="receipt-hash-container">
                    <span id="receiptHashText">${commitmentHash}</span>
                    <button type="button" class="copy-hash-btn" id="copyHashBtn" aria-label="Copy hash to clipboard">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
            </div>

            <!-- Privacy Guarantee Callout -->
            <div style="background-color: var(--primary-subtle); border: 1px solid var(--primary-border); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.8rem; color: var(--text-secondary); text-align: left; margin-bottom: 24px;">
                <i class="fas fa-user-secret" style="color: var(--primary); margin-right: 6px;"></i>
                <strong>Zero-Correlation Guarantee:</strong> This receipt proves your participation without revealing your candidate choice to administrators, observers, or eavesdroppers.
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button type="button" class="btn-secondary" onclick="window.print()">
                    <i class="fas fa-print"></i> Print Official Receipt
                </button>
                <a href="v-result.html" class="btn-primary">
                    <i class="fas fa-chart-pie"></i> View Live Results
                </a>
            </div>
        </div>
    `;

    const copyBtn = document.getElementById('copyHashBtn');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(commitmentHash).then(() => {
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            }).catch(() => {
                showToast('Could not copy hash automatically.', 'info');
            });
        };
    }
}

// Global escape key handler to safely close modals or navigate back
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const biometricCard = document.getElementById('stepBiometricCard');
        if (biometricCard && !biometricCard.classList.contains('hidden')) {
            stopCameraStream();
            updateStepper(2);
            showPane('stepReviewCard');
        }
    }
});

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    loadVoterParties();
});
