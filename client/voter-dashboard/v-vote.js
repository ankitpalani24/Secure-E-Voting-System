// Load parties for voter voting - PUBLIC endpoint
async function loadVoterParties() {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = '../../login/login.html';

    try {
        const userName = localStorage.getItem('userName') || 'Voter';
        const headerP = document.querySelector('.header-left p');
        if (headerP) headerP.textContent = `Welcome, ${userName}`;

        const profileRes = await fetch('http://localhost:5000/api/voter/profile', {
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
        const res = await fetch('http://localhost:5000/api/party', { 
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
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'),
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
            detectInterval = setInterval(async () => {
                // Stop scanning if they already clicked verify
                if (isVerifying) return;

                if (videoEl.readyState === 4) {
                    const detection = await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
                    
                    if (isVerifying) return; // double check

                    if (detection) {
                        statusEl.textContent = 'Face detected!';
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
                                const res = await fetch('http://localhost:5000/api/voter/face-verify', {
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
                                    alert(data.message || 'Face verification failed');
                                }
                                resolve(res.ok);
                            } catch (err) {
                                console.error('Verification error:', err);
                                popup.remove();
                                if (videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());
                                alert('Network error during verification');
                                resolve(false);
                            }
                        };
                    } else {
                        statusEl.textContent = 'No face - look at camera';
                        statusEl.style.color = 'orange';
                        verifyBtn.disabled = true;
                        verifyBtn.onclick = null;
                    }
                }
            }, 500);
        }
    });
}

async function voteForParty(partyId) {
    const token = localStorage.getItem('token');

    // Face verification first
    const verified = await performFaceVerification();
    if (!verified) {
        alert('Face verification failed or already voted!');
        return;
    }

    const res = await fetch('http://localhost:5000/api/voter/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partyId })
    });

    const data = await res.json();
    if (res.ok) {
        alert('Vote cast successfully!');
        window.location.href = 'v-result.html';
    } else {
        alert(data.message || 'Vote failed!');
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
