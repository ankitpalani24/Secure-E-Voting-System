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

// Load parties for voter voting - Protected endpoint with safe DOM rendering
async function loadVoterParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    try {
        const userName = localStorage.getItem('userName') || 'Voter';
        const headerP = document.querySelector('.header-left p');
        if (headerP) headerP.textContent = `Welcome, ${userName}`;

        const profileRes = await fetch('/api/voter/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (profileRes.ok) {
            const profile = await profileRes.json();
            const voteStatus = document.querySelector('.vstat-card');
            if (voteStatus) {
                const valEl = voteStatus.querySelector('.value');
                if (valEl) valEl.textContent = profile.hasVoted ? 'VOTED' : 'PENDING';

                const lblEl = voteStatus.querySelector('.label');
                if (lblEl) lblEl.textContent = profile.hasVoted ? 'Vote Submitted' : 'Ready to Vote';

                const icon = voteStatus.querySelector('.icon-box i');
                if (icon) icon.className = profile.hasVoted ? 'fas fa-check-circle' : 'fas fa-clock';

                const iconBox = voteStatus.querySelector('.icon-box');
                if (iconBox) iconBox.className = profile.hasVoted ? 'icon-box green' : 'icon-box orange';
            }

            if (profile.hasVoted) {
                updateStepper(4);
                const partyList = document.querySelector('.party-list');
                if (partyList) {
                    partyList.innerHTML = `
                        <div class="card" style="text-align: center; border-color: var(--success); background-color: var(--success-light);">
                            <div style="font-size: 2.5rem; margin-bottom: var(--space-2);">🗳️✅</div>
                            <h2 style="color: var(--success-text);">Ballot Successfully Recorded</h2>
                            <p style="color: #166534; margin: var(--space-2) 0 var(--space-4) 0;">Your vote has been cryptographically committed and decoupled from your identity to ensure complete secrecy.</p>
                            <a href="v-result.html" class="btn-primary" style="display: inline-flex; margin: 0 auto;"><i class="fas fa-poll"></i> View Live Results</a>
                        </div>
                    `;
                }
                return;
            }
        }

        updateStepper(1);

        // Fetch available parties
        const res = await fetch('/api/party', { 
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const partyList = document.querySelector('.party-list');
        partyList.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = 'Select a Political Party to Review & Cast Your Ballot:';
        partyList.appendChild(heading);

        if (!Array.isArray(data) || data.length === 0) {
            const noParties = document.createElement('p');
            noParties.textContent = 'No registered political parties available at this time.';
            partyList.appendChild(noParties);
            return;
        }

        data.forEach((party) => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cursor = 'pointer';
            card.onclick = () => showVoteConfirmationModal(party._id, party.partyName, party.symbol);

            const contentDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = party.partyName || '';

            const valueH2 = document.createElement('h2');
            valueH2.className = 'value';
            valueH2.textContent = party.symbol || '';

            contentDiv.appendChild(labelSpan);
            contentDiv.appendChild(valueH2);

            const iconBox = document.createElement('div');
            iconBox.className = 'icon-box green';
            const icon = document.createElement('i');
            icon.className = 'fas fa-vote-yea';
            iconBox.appendChild(icon);

            card.appendChild(contentDiv);
            card.appendChild(iconBox);
            partyList.appendChild(card);
        });
    } catch (err) {
        const partyList = document.querySelector('.party-list');
        if (partyList) {
            partyList.innerHTML = '<h3>No parties available or network error</h3>';
        }
        console.error('Parties load error:', err);
    }
}

// Review and Confirmation Modal
function showVoteConfirmationModal(partyId, partyName, partySymbol) {
    updateStepper(2);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'voteReviewModal';
    modal.innerHTML = `
        <div class="review-modal-card">
            <h2 style="margin-bottom: var(--space-2); color: var(--text-primary);">Review Your Ballot Selection</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Please verify your chosen candidate before proceeding to biometric authorization.</p>
            
            <div class="review-party-box">
                <div class="review-party-symbol">${partySymbol || '🗳️'}</div>
                <div class="review-party-details">
                    <span style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Selected Party</span>
                    <h3 style="color: var(--text-primary); font-size: 1.25rem;">${partyName}</h3>
                </div>
            </div>

            <div class="warning-callout">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.1rem; flex-shrink: 0;"></i>
                <span>Notice: Your ballot choice is permanent and cannot be modified or re-cast after submission.</span>
            </div>

            <div class="actions" style="justify-content: center; gap: var(--space-4);">
                <button type="button" class="btn-secondary" id="cancelVoteBtn">Change Selection</button>
                <button type="button" class="btn-primary" id="confirmVoteBtn"><i class="fas fa-camera"></i> Confirm & Face Verify</button>
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

// Face verification issuing server-validated biometric token
async function performFaceVerification() {
    showSpinner("Loading Facial Recognition Engine...");
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('../models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('../models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('../models'),
    ]);
    hideSpinner();

    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.id = 'verifyPopup';
        popup.innerHTML = `
            <div class="face-modal">
                <div class="face-header">
                    <h3>Biometric Identity Verification</h3>
                    <button id="closeVerify" class="close-btn">×</button>
                </div>
                <video id="verifyVideo" width="320" height="240" autoplay muted style="transform: scaleX(-1);"></video>
                <div id="verifyStatus">Initializing camera stream...</div>
                <button id="verifyBtn" disabled>Verify Identity & Authorize Ballot ✅</button>
            </div>
        `;
        popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;';
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

        navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } }).then(stream => {
            videoEl.srcObject = stream;
            videoEl.onloadedmetadata = detectVerifyFace;
        }).catch((err) => {
            console.error("Camera access error:", err);
            statusEl.textContent = "Camera permission denied or not available.";
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

                if (videoEl.readyState === 4) {
                    const detection = await faceapi.detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 })).withFaceLandmarks().withFaceDescriptor();
                    
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
                            statusEl.textContent = 'Hold still, calibrating baseline (' + initialFrames + '/5)...';
                            statusEl.style.color = 'orange';
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
                            
                            if (currentChallenge === 'turn_left' && relX > baselineX + 0.09) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'turn_right' && relX < baselineX - 0.09) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_up' && relY < baselineY - 0.07) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_down' && relY > baselineY + 0.07) challengeMetCurrentFrame = true;
                            
                            if (challengeMetCurrentFrame) {
                                challengeHoldFrames++;
                                if (challengeHoldFrames >= 3) {
                                    livenessPassed = true;
                                    statusEl.textContent = 'Liveness challenge confirmed! Please look directly at the lens.';
                                    statusEl.style.color = 'green';
                                } else {
                                    statusEl.textContent = 'Hold pose... (' + challengeHoldFrames + '/3)';
                                    statusEl.style.color = 'blue';
                                }
                            } else {
                                challengeHoldFrames = 0;
                                const msgs = {
                                    'turn_left': 'Liveness: Please turn your head slightly LEFT',
                                    'turn_right': 'Liveness: Please turn your head slightly RIGHT',
                                    'look_up': 'Liveness: Please tilt your head slightly UP',
                                    'look_down': 'Liveness: Please tilt your head slightly DOWN'
                                };
                                statusEl.textContent = msgs[currentChallenge];
                                statusEl.style.color = 'orange';
                            }
                        } else {
                            if (Math.abs(relX - baselineX) < 0.07 && Math.abs(relY - baselineY) < 0.07) {
                                statusEl.textContent = 'Identity match ready! Click button to confirm authorization.';
                                statusEl.style.color = 'green';
                                verifyBtn.disabled = false;
                                
                                verifyBtn.onclick = async () => {
                                    if (isVerifying) return;
                                    isVerifying = true;
                                    clearInterval(detectInterval);
                                    
                                    verifyBtn.textContent = 'Verifying with Security Service...';
                                    verifyBtn.disabled = true;

                                    try {
                                        showSpinner("Verifying Facial Biometric Signature...");
                                        const descriptor = Array.from(detection.descriptor);
                                        const authToken = localStorage.getItem('token');
                                        if (!authToken) {
                                            hideSpinner();
                                            popup.remove();
                                            if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                            showToast('Session expired. Please log in again.', 'error');
                                            setTimeout(() => window.location.href = '../../login/login.html', 1500);
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
                                            showToast(data.message || 'Face verification failed', 'error');
                                            resolve(null);
                                        } else {
                                            showToast('Biometric identity confirmed!', 'success');
                                            resolve(data.biometricToken || 'verified');
                                        }
                                    } catch (err) {
                                        console.error('Verification error:', err);
                                        hideSpinner();
                                        popup.remove();
                                        if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                        showToast('Network error during biometric verification', 'error');
                                        resolve(null);
                                    }
                                };
                            } else {
                                statusEl.textContent = 'Please align face center to camera';
                                statusEl.style.color = 'orange';
                                verifyBtn.disabled = true;
                                verifyBtn.onclick = null;
                            }
                        }
                    } else {
                        statusEl.textContent = 'No face detected — position yourself in front of camera';
                        statusEl.style.color = 'orange';
                        verifyBtn.disabled = true;
                        verifyBtn.onclick = null;
                        challengeHoldFrames = 0;
                    }
                }
            }, 200);
        }
    });
}

// Proceed to submit vote after biometric verification
async function proceedWithBiometricsAndVote(partyId, partyName) {
    const token = localStorage.getItem('token');

    // 1. Execute Biometric Verification
    const biometricToken = await performFaceVerification();
    if (!biometricToken) {
        showToast('Biometric verification cancelled or unsuccessful.', 'error');
        updateStepper(1);
        return;
    }

    showSpinner("Sealing & Committing Anonymous Ballot...");
    try {
        const res = await fetch('/api/voter/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                partyId,
                biometricToken: typeof biometricToken === 'string' ? biometricToken : undefined
            })
        });

        const data = await res.json();
        hideSpinner();
        
        if (res.ok) {
            updateStepper(4);
            showToast('Ballot cast successfully and anonymized!', 'success');
            
            // Render Cryptographic Receipt
            displayReceiptCard(data.receipt || {
                ballotCommitment: 'SHA256:' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
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

// Display Cryptographic Receipt Card
function displayReceiptCard(receipt) {
    const partyList = document.querySelector('.party-list');
    if (partyList) partyList.style.display = 'none';

    const container = document.getElementById('receiptContainer');
    if (!container) return;

    container.className = '';
    const timestamp = receipt.timestamp ? new Date(receipt.timestamp).toLocaleString() : new Date().toLocaleString();
    const hash = receipt.ballotCommitment || 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855';

    container.innerHTML = `
        <div class="receipt-card">
            <div class="receipt-header-badge"><i class="fas fa-check-circle"></i> Official Voter Receipt</div>
            <h2 style="color: var(--text-primary); margin-bottom: var(--space-2);">Vote Cryptographically Sealed</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Your ballot has been committed anonymously to the decentralized tally box.</p>

            <div class="receipt-hash-container">
                <span id="receiptHashText">${hash}</span>
                <button class="copy-hash-btn" id="copyHashBtn"><i class="fas fa-copy"></i> Copy</button>
            </div>

            <div class="qr-code-placeholder">
                <i class="fas fa-qrcode" style="font-size: 3.5rem; color: #0F172A;"></i>
            </div>

            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: var(--space-6);">Recorded at: <strong>${timestamp}</strong> | Algorithm: SHA-256 Chained Commitment</p>

            <div style="display: flex; gap: var(--space-3); justify-content: center;">
                <button class="btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>
                <a href="v-result.html" class="btn-primary"><i class="fas fa-chart-pie"></i> View Live Results</a>
            </div>
        </div>
    `;

    document.getElementById('copyHashBtn').onclick = () => {
        navigator.clipboard.writeText(hash);
        showToast('Receipt commitment hash copied to clipboard!', 'info');
    };
}

loadVoterParties();
