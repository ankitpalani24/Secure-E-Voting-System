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
                const partyList = document.querySelector('.party-list');
                if (partyList) {
                    partyList.innerHTML = '<div style="padding: 20px; background: #e6ffed; border: 1px solid #10b981; border-radius: 8px; color: #065f46;"><h3>✅ You have already cast your ballot.</h3><p>Thank you for participating. Results are viewable on the Results tab.</p></div>';
                }
                return;
            }
        }

        // Fetch available parties
        const res = await fetch('/api/party', { 
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const partyList = document.querySelector('.party-list');
        partyList.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = '🔐 Face Verify & Select Party to Cast Ballot:';
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
            card.onclick = () => voteForParty(party._id, party.partyName);

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

async function voteForParty(partyId, partyName) {
    const token = localStorage.getItem('token');

    // 1. Enforce Biometric Verification & Token Issuance First
    const biometricToken = await performFaceVerification();
    if (!biometricToken) {
        showToast('Biometric verification failed or was cancelled.', 'error');
        return;
    }

    showSpinner("Submitting Anonymous Ballot securely...");
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
            showToast('Ballot cast successfully and anonymized!', 'success');
            setTimeout(() => window.location.href = 'v-result.html', 1500);
        } else {
            showToast(data.message || 'Ballot submission failed!', 'error');
        }
    } catch (err) {
        hideSpinner();
        showToast("Network error: " + err.message, "error");
    }
}

loadVoterParties();

// Hover logout
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
