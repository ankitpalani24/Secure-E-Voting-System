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
let currentElection = null;

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

// Step 1: Load Accredited Parties & Scoped Election Validation
async function loadVoterParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../login/login.html';

    const voterName = localStorage.getItem('userName');
    const nameEl = document.getElementById('voterProfileName');
    if (nameEl && voterName) nameEl.textContent = voterName;

    const urlParams = new URLSearchParams(window.location.search);
    let targetElectionId = urlParams.get('electionId');

    try {
        // 1. Election-Scoped Status Validation
        if (targetElectionId) {
            const statusRes = await fetch(`/api/voter/elections/${targetElectionId}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (statusRes.ok) {
                const electionStatus = await statusRes.json();
                currentElection = electionStatus;

                if (electionStatus.hasVoted) {
                    renderAlreadyVotedState(electionStatus);
                    return;
                }
                if (!electionStatus.eligible) {
                    renderIneligibleState(electionStatus);
                    return;
                }
                if (!electionStatus.isVotingAllowed) {
                    renderVotingClosedState(electionStatus);
                    return;
                }
            }
        } else {
            // If no electionId in URL, fetch voter's eligible elections
            const elRes = await fetch('/api/voter/elections', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (elRes.ok) {
                const elections = await elRes.json();
                const activeEl = elections.find(e => e.phase === 'VOTING' && !e.hasVoted) || elections[0];
                if (activeEl && activeEl._id) {
                    targetElectionId = activeEl._id;
                    currentElection = activeEl;
                    const newUrl = `${window.location.pathname}?electionId=${targetElectionId}`;
                    window.history.replaceState({ electionId: targetElectionId }, '', newUrl);

                    if (activeEl.hasVoted) {
                        renderAlreadyVotedState(activeEl);
                        return;
                    }
                } else if (elections.length === 0) {
                    renderNoElectionsState();
                    return;
                }
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
                    <p class="empty-state-text">There are currently no active political party slates registered for this election.</p>
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

// Render "Already Voted" Screen for this Election
function renderAlreadyVotedState(electionStatus) {
    updateStepper(4);
    const ballotCard = document.getElementById('ballotSelectionCard');
    const title = electionStatus?.title || 'This Election';
    const elId = electionStatus?.electionId || electionStatus?._id || '';

    if (ballotCard) {
        ballotCard.innerHTML = `
            <div class="empty-state-box" style="padding: 48px 20px;">
                <div class="empty-state-icon" style="color: var(--success);"><i class="fas fa-check-circle"></i></div>
                <h2 class="empty-state-title" style="font-size: 1.5rem; margin-bottom: 8px;">Ballot Already Recorded</h2>
                <p class="empty-state-text">Your anonymous vote for <strong>${escapeHtml(title)}</strong> is cryptographically sealed in the ballot repository. Double voting is mathematically blocked.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <a href="v-dashboard.html" class="btn-secondary"><i class="fas fa-id-card"></i> Voter Dashboard</a>
                    <a href="v-result.html?electionId=${elId}" class="btn-primary"><i class="fas fa-poll"></i> View Live Results</a>
                </div>
            </div>
        `;
    }
}

function renderIneligibleState(electionStatus) {
    const ballotCard = document.getElementById('ballotSelectionCard');
    if (ballotCard) {
        ballotCard.innerHTML = `
            <div class="empty-state-box" style="padding: 48px 20px;">
                <div class="empty-state-icon" style="color: var(--danger);"><i class="fas fa-ban"></i></div>
                <h2 class="empty-state-title" style="font-size: 1.4rem; margin-bottom: 8px;">Not Accredited For This Election</h2>
                <p class="empty-state-text">${escapeHtml(electionStatus.eligibilityReason || 'Your voter profile is not registered in this jurisdiction.')}</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <a href="v-dashboard.html" class="btn-primary"><i class="fas fa-arrow-left"></i> Return to Dashboard</a>
                </div>
            </div>
        `;
    }
}

function renderVotingClosedState(electionStatus) {
    const ballotCard = document.getElementById('ballotSelectionCard');
    if (ballotCard) {
        ballotCard.innerHTML = `
            <div class="empty-state-box" style="padding: 48px 20px;">
                <div class="empty-state-icon" style="color: var(--warning);"><i class="fas fa-lock"></i></div>
                <h2 class="empty-state-title" style="font-size: 1.4rem; margin-bottom: 8px;">Voting Window Closed</h2>
                <p class="empty-state-text">${escapeHtml(electionStatus.votingWindowReason || 'Voting is not open at this time.')}</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <a href="v-dashboard.html" class="btn-secondary"><i class="fas fa-id-card"></i> Dashboard</a>
                    <a href="v-result.html?electionId=${electionStatus.electionId || ''}" class="btn-primary"><i class="fas fa-poll"></i> View Results</a>
                </div>
            </div>
        `;
    }
}

function renderNoElectionsState() {
    const ballotCard = document.getElementById('ballotSelectionCard');
    if (ballotCard) {
        ballotCard.innerHTML = `
            <div class="empty-state-box" style="padding: 48px 20px;">
                <div class="empty-state-icon"><i class="fas fa-info-circle"></i></div>
                <h2 class="empty-state-title">No Active Elections Available</h2>
                <p class="empty-state-text">There are currently no active voting elections available for your jurisdiction.</p>
                <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                    <a href="v-dashboard.html" class="btn-primary"><i class="fas fa-arrow-left"></i> Return to Dashboard</a>
                </div>
            </div>
        `;
    }
}

// Step 1 -> Step 2: Continue to Review
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

// Step 2 -> Step 1: Change Selection
const changeSelectionBtn = document.getElementById('changeSelectionBtn');
if (changeSelectionBtn) {
    changeSelectionBtn.onclick = () => {
        updateStepper(1);
        showPane('ballotSelectionCard');
    };
}

// Step 2 -> Step 3: Proceed to Biometrics
const proceedToBiometricsBtn = document.getElementById('proceedToBiometricsBtn');
if (proceedToBiometricsBtn) {
    proceedToBiometricsBtn.onclick = async () => {
        updateStepper(3);
        showPane('stepBiometricCard');
        await initializeBiometricFeed();
    };
}

// Step 3 -> Step 2: Cancel Biometrics
const cancelBiometricsBtn = document.getElementById('cancelBiometricsBtn');
if (cancelBiometricsBtn) {
    cancelBiometricsBtn.onclick = () => {
        stopCameraStream();
        updateStepper(2);
        showPane('stepReviewCard');
    };
}

// Initialize Live Biometric Camera & Face-api Descriptor Tracking
async function initializeBiometricFeed() {
    const video = document.getElementById('voterVideo');
    const statusBadge = document.getElementById('biometricStatusBadge');
    const captureBtn = document.getElementById('captureAndVoteBtn');
    const ovalGuide = document.getElementById('faceGuideOval');

    if (!video || !statusBadge || !captureBtn) return;

    statusBadge.className = 'biometric-status-pill detecting';
    statusBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing Biometric Camera...';
    captureBtn.disabled = true;

    try {
        await preloadVoterModels();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
            },
            audio: false,
        });

        activeCameraStream = stream;
        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            statusBadge.className = 'biometric-status-pill detecting';
            statusBadge.innerHTML = '<i class="fas fa-crosshairs"></i> Align your face within the guide...';

            if (faceDetectionInterval) clearInterval(faceDetectionInterval);

            faceDetectionInterval = setInterval(async () => {
                if (!video || video.paused || video.ended) return;

                try {
                    const detection = await faceapi
                        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (detection) {
                        activeDescriptor = Array.from(detection.descriptor);
                        statusBadge.className = 'biometric-status-pill ready';
                        statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Face Aligned &mdash; Ready to Verify';
                        captureBtn.disabled = false;
                        if (ovalGuide) ovalGuide.classList.add('aligned');
                    } else {
                        activeDescriptor = null;
                        statusBadge.className = 'biometric-status-pill detecting';
                        statusBadge.innerHTML = '<i class="fas fa-crosshairs"></i> Position face in center of oval';
                        captureBtn.disabled = true;
                        if (ovalGuide) ovalGuide.classList.remove('aligned');
                    }
                } catch (detErr) {
                    console.warn('Detection tick notice:', detErr);
                }
            }, 300);
        };
    } catch (camErr) {
        console.error('Camera access error:', camErr);
        if (statusBadge) {
            statusBadge.className = 'biometric-status-pill error';
            statusBadge.innerHTML = '<i class="fas fa-video-slash"></i> Camera access denied or unavailable';
        }
        showToast('Camera stream could not be accessed. Please ensure HTTPS and camera permissions are granted.', 'error', 6000);
    }
}

// Step 3 -> Step 4: Capture, Verify & Cast Ballot
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
            const urlParams = new URLSearchParams(window.location.search);
            const currentElectionId = urlParams.get('electionId') || (currentElection ? currentElection.electionId || currentElection._id : undefined);

            // 1. Biometric verification step
            const verifyRes = await fetch('/api/voter/face-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    faceDescriptor: activeDescriptor,
                    electionId: currentElectionId,
                }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                captureAndVoteBtn.disabled = false;
                captureAndVoteBtn.innerHTML = '<i class="fas fa-check-circle"></i> Retry Verification';
                showToast(verifyData.message || 'Biometric identity mismatch. Verification rejected.', 'error');
                return;
            }

            // 2. Ballot commit step using single-use biometricToken
            const voteRes = await fetch('/api/voter/vote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    partyId: selectedParty.id,
                    biometricToken: verifyData.biometricToken,
                    electionId: currentElectionId || verifyData.electionId,
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

    const commitmentHash = receipt.ballotCommitmentHash || receipt.ballotCommitment || receipt.ballotId || '0000-COMMITMENT-HASH-ANONYMOUS';
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
                <a href="v-dashboard.html" class="btn-secondary">
                    <i class="fas fa-arrow-left"></i> Voter Dashboard
                </a>
                <a href="v-result.html" class="btn-primary">
                    <i class="fas fa-chart-pie"></i> View Results
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
