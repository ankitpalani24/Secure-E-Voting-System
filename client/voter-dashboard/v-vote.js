// Load parties for voter voting - PUBLIC endpoint
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
                voteStatus.querySelector('.value').textContent = profile.hasVoted ? 'VOTED' : 'PENDING';
                voteStatus.querySelector('.label').textContent = profile.hasVoted ? 'Vote Submitted' : 'Ready to Vote';
                const icon = voteStatus.querySelector('.icon-box i');
                if (icon) icon.className = profile.hasVoted ? 'fas fa-check-circle' : 'fas fa-clock';
                const iconBox = voteStatus.querySelector('.icon-box');
                if (iconBox) iconBox.className = profile.hasVoted ? 'icon-box green' : 'icon-box orange';
            }
        }
        // Use party route to get all available parties
        const res = await fetch('/api/party', { 
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const partyList = document.querySelector('.party-list');
        partyList.innerHTML = '<h3>🔐 Face Verify to Vote:</h3>';

        data.forEach((party) => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cursor = 'pointer';
            card.onclick = () => voteForParty(party._id);
            card.innerHTML = `
                <div>
                    <span class="label">${party.partyName}</span>
                    <h2 class="value">${party.symbol}</h2>
                </div>
                <div class="icon-box green"><i class="fas fa-vote-yea"></i></div>
            `;
            partyList.appendChild(card);
        });
    } catch (err) {
        document.querySelector('.party-list').innerHTML = '<h3>No parties available or network error</h3>';
        console.error('Parties load error:', err);
    }
}

// Face verification
async function performFaceVerification() {
    // Load models
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
    ]);

    const token = localStorage.getItem('token');
    const decoded = JSON.parse(atob(token.split('.')[1]));
    const voterEmail = decoded.email;

    return new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.id = 'verifyPopup';
        popup.innerHTML = `
            <div class="face-modal">
                <div class="face-header">
                    <h3>Face Verification</h3>
                    <button id="closeVerify" class="close-btn">×</button>
                </div>
                <video id="verifyVideo" width="320" height="240" autoplay muted style="transform: scaleX(-1);"></video>
                <div id="verifyStatus">Loading camera...</div>
                <button id="verifyBtn" disabled>Verify Identity ✅</button>
            </div>
        `;
        popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(popup);

        document.getElementById('closeVerify').onclick = () => {
            popup.remove();
            if (videoEl && videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
            resolve(false);
        };

        const videoEl = document.getElementById('verifyVideo');
        const statusEl = document.getElementById('verifyStatus');
        const verifyBtn = document.getElementById('verifyBtn');

        navigator.mediaDevices.getUserMedia({ video: {} }).then(stream => {
            videoEl.srcObject = stream;
            videoEl.onloadedmetadata = detectVerifyFace;
        }).catch(() => resolve(false));
        
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
                // Stop scanning if they already clicked verify
                if (isVerifying) return;

                if (videoEl.readyState === 4) {
                    const detection = await faceapi.detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 })).withFaceLandmarks().withFaceDescriptor();
                    
                    if (isVerifying) return; // double check

                    if (detection) {
                        const box = detection.detection.box;
                        const noseTip = detection.landmarks.getNose()[3];
                        const relX = (noseTip.x - box.x) / box.width;
                        const relY = (noseTip.y - box.y) / box.height;

                        if (initialFrames < 5) {
                            baselineX += relX;
                            baselineY += relY;
                            initialFrames++;
                            statusEl.textContent = 'Hold still, initializing (' + initialFrames + '/5)...';
                            statusEl.style.color = 'orange';
                            verifyBtn.disabled = true;
                            
                            if (initialFrames === 5) {
                                baselineX /= 5; // Average over 5 frames
                                baselineY /= 5;
                            }
                            return;
                        }
                        
                        if (!livenessPassed) {
                            verifyBtn.disabled = true;
                            let challengeMetCurrentFrame = false;
                            
                            if (currentChallenge === 'turn_left' && relX > baselineX + 0.10) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'turn_right' && relX < baselineX - 0.10) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_up' && relY < baselineY - 0.08) challengeMetCurrentFrame = true;
                            else if (currentChallenge === 'look_down' && relY > baselineY + 0.08) challengeMetCurrentFrame = true;
                            
                            if (challengeMetCurrentFrame) {
                                challengeHoldFrames++;
                                if (challengeHoldFrames >= 3) {
                                    livenessPassed = true;
                                    statusEl.textContent = 'Challenge passed! Now look straight.';
                                    statusEl.style.color = 'green';
                                } else {
                                    statusEl.textContent = 'Hold position... (' + challengeHoldFrames + '/3)';
                                    statusEl.style.color = 'blue';
                                }
                            } else {
                                challengeHoldFrames = 0; // Reset if they flinch or it was a jitter
                                const msgs = {
                                    'turn_left': 'Please turn your head slowly LEFT',
                                    'turn_right': 'Please turn your head slowly RIGHT',
                                    'look_up': 'Please tilt your head slowly UP',
                                    'look_down': 'Please tilt your head slowly DOWN'
                                };
                                statusEl.textContent = "Liveness: " + msgs[currentChallenge];
                                statusEl.style.color = 'orange';
                            }
                        } else {
                            // Check if returned to looking straight
                            if (Math.abs(relX - baselineX) < 0.06 && Math.abs(relY - baselineY) < 0.06) {
                                statusEl.textContent = 'Face detected and ready!';
                                statusEl.style.color = 'green';
                                verifyBtn.disabled = false;
                                
                                verifyBtn.onclick = async () => {
                                    if (isVerifying) return;
                                    isVerifying = true;
                                    clearInterval(detectInterval);
                                    
                                    verifyBtn.textContent = 'Verifying...';
                                    verifyBtn.disabled = true;

                                    try {
                                        const descriptor = Array.from(detection.descriptor);
                                        const res = await fetch('/api/voter/face-verify', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify({ descriptor })
                                        });
                                        
                                        const data = await res.json();
                                        popup.remove();
                                        if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                        
                                        if (!res.ok) {
                                            showToast(data.message || 'Face verification failed', 'error');
                                        }
                                        resolve(res.ok);
                                    } catch (err) {
                                        console.error('Verification error:', err);
                                        popup.remove();
                                        if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                        showToast('Network error during verification', 'error');
                                        resolve(false);
                                    }
                                };
                            } else {
                                statusEl.textContent = 'Please look straight at the camera';
                                statusEl.style.color = 'orange';
                                verifyBtn.disabled = true;
                                verifyBtn.onclick = null;
                            }
                        }
                    } else {
                        statusEl.textContent = 'No face - look at camera';
                        statusEl.style.color = 'orange';
                        verifyBtn.disabled = true;
                        verifyBtn.onclick = null;
                        challengeHoldFrames = 0; // Reset on face loss
                    }
                }
            }, 200);
        }
    });
}

async function voteForParty(partyId) {
    const token = localStorage.getItem('token');

    // Face verification first
    const verified = await performFaceVerification();
    if (!verified) {
        showToast('Face verification failed or already voted!', 'error');
        return;
    }

    const res = await fetch('/api/voter/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partyId })
    });

    const data = await res.json();
    if (res.ok) {
        showToast('Vote cast successfully!', 'success');
        setTimeout(() => window.location.href = 'v-result.html', 1500);
    } else {
        showToast(data.message || 'Vote failed!', 'error');
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
