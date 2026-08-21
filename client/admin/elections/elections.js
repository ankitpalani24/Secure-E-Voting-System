// ==========================================================================
// ADMIN MULTI-ELECTION & JURISDICTION CENTER CONTROLLER
// ==========================================================================

let allElections = [];
let allJurisdictions = [];
let currentWizardStep = 1;
const TOTAL_WIZARD_STEPS = 7;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce Admin Access
    if (!checkAuth('admin')) return;

    const userName = localStorage.getItem('userName');
    if (userName) {
        const adminNameEl = document.getElementById('adminUserName');
        if (adminNameEl) adminNameEl.textContent = userName;
    }

    // 2. Setup Default Dates in Wizard (Start: Now, End: +7 Days)
    setupDefaultWizardDates();

    // 3. Load Data
    await loadJurisdictions();
    await loadElections();

    // 4. Setup Filters & Actions
    setupEventListeners();
});

function setupDefaultWizardDates() {
    const startInput = document.getElementById('wStartDate');
    const endInput = document.getElementById('wEndDate');
    if (startInput && endInput) {
        const now = new Date();
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        startInput.value = now.toISOString().slice(0, 16);
        endInput.value = nextWeek.toISOString().slice(0, 16);
    }
}

// ================= LOAD DATA =================
async function loadJurisdictions() {
    try {
        const res = await fetch('/api/admin/jurisdictions', { credentials: 'omit', headers: getAuthHeaders() });
        if (res.ok) {
            allJurisdictions = await res.json();
            populateJurisdictionSelect();
        }
    } catch (err) {
        console.error('Failed to load jurisdictions:', err);
    }
}

function populateJurisdictionSelect() {
    const sel = document.getElementById('wJurisdiction');
    if (!sel) return;
    sel.innerHTML = '';

    if (allJurisdictions.length === 0) {
        sel.innerHTML = '<option value="">National Territory (Default)</option>';
        return;
    }

    allJurisdictions.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j._id;
        const parentName = j.parentId && j.parentId.name ? ` (${j.parentId.name})` : '';
        opt.textContent = `[${j.type}] ${j.name}${parentName} — ${j.code}`;
        sel.appendChild(opt);
    });
}

async function loadElections() {
    const container = document.getElementById('electionsGridContainer');
    if (!container) return;

    try {
        const search = document.getElementById('electionSearchInput')?.value || '';
        const type = document.getElementById('typeFilter')?.value || 'ALL';
        const phase = document.getElementById('phaseFilter')?.value || 'ALL';

        let url = `/api/admin/elections?`;
        if (type !== 'ALL') url += `type=${encodeURIComponent(type)}&`;
        if (phase !== 'ALL') url += `phase=${encodeURIComponent(phase)}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) {
            handleAuthResponse(res);
            throw new Error('Failed to fetch elections');
        }

        allElections = await res.json();
        renderElections(allElections);
    } catch (err) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top: 8px;">Failed to load elections. Please try again.</p>
            </div>
        `;
    }
}

function renderElections(elections) {
    const container = document.getElementById('electionsGridContainer');
    if (!container) return;

    if (!elections || elections.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-xl);">
                <i class="fas fa-layer-group fa-3x" style="color: var(--text-muted); margin-bottom: 12px;"></i>
                <h3 style="font-size: 1.1rem; color: var(--text-primary);">No Elections Found</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">No elections matching your filters were found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = elections.map(el => {
        const phaseBadgeClass = getPhaseBadgeClass(el.phase);
        const jName = el.jurisdictionId ? el.jurisdictionId.name : 'National Territory';
        const jCode = el.jurisdictionId ? el.jurisdictionId.code : 'NAT-01';
        const startStr = new Date(el.startDate).toLocaleDateString();
        const endStr = new Date(el.endDate).toLocaleDateString();

        return `
            <div class="election-card">
                <div>
                    <div class="election-card-header">
                        <div>
                            <span class="election-type-tag"><i class="fas fa-landmark"></i> ${el.electionType || 'NATIONAL'}</span>
                            <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-top: 6px;">${escapeHtml(el.title)}</h3>
                            <span style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(el.electionCode || (el._id ? el._id.slice(-6).toUpperCase() : 'ELEC'))}</span>
                        </div>
                        <span class="status-badge ${phaseBadgeClass}">${el.phase}</span>
                    </div>

                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
                        ${escapeHtml(el.description || 'Standard electronic democratic election.')}
                    </p>

                    <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                        <div><i class="fas fa-map-marker-alt" style="color: var(--primary); width: 16px;"></i> <strong>${escapeHtml(jName)}</strong> (${escapeHtml(jCode)})</div>
                        <div><i class="fas fa-clock" style="color: var(--text-muted); width: 16px;"></i> ${startStr} &rarr; ${endStr}</div>
                    </div>
                </div>

                <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <a href="../results/results.html?electionId=${el._id}" class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;">
                        <i class="fas fa-chart-pie"></i> Standings
                    </a>
                    <a href="../dashboard/dashboard.html?electionId=${el._id}" class="btn-primary" style="padding: 6px 14px; font-size: 0.78rem; background-color: var(--primary);">
                        <i class="fas fa-sliders-h"></i> Manage
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

function getPhaseBadgeClass(phase) {
    switch (phase) {
        case 'VOTING': return 'live';
        case 'SCHEDULED': return 'pending';
        case 'CLOSED': return 'closed';
        case 'RESULTS_PUBLISHED': return 'published';
        case 'ARCHIVED': return 'neutral';
        default: return 'pending';
    }
}

// ================= WIZARD CONTROLLER =================
function setupEventListeners() {
    const searchInput = document.getElementById('electionSearchInput');
    const typeFilter = document.getElementById('typeFilter');
    const phaseFilter = document.getElementById('phaseFilter');
    const refreshBtn = document.getElementById('refreshElectionsBtn');

    if (searchInput) searchInput.oninput = debounce(loadElections, 300);
    if (typeFilter) typeFilter.onchange = loadElections;
    if (phaseFilter) phaseFilter.onchange = loadElections;
    if (refreshBtn) refreshBtn.onclick = loadElections;

    // Wizard modal open/close
    const openWizardBtn = document.getElementById('openCreateElectionWizardBtn');
    const closeWizardBtn = document.getElementById('closeWizardBtn');
    const cancelWizardBtn = document.getElementById('wCancelBtn');
    const modal = document.getElementById('createElectionModal');

    if (openWizardBtn && modal) {
        openWizardBtn.onclick = () => {
            modal.classList.remove('hidden');
            goToWizardStep(1);
        };
    }

    if (closeWizardBtn && modal) closeWizardBtn.onclick = () => modal.classList.add('hidden');
    if (cancelWizardBtn && modal) cancelWizardBtn.onclick = () => modal.classList.add('hidden');

    // Wizard Nav Buttons
    const nextBtn = document.getElementById('wNextBtn');
    const backBtn = document.getElementById('wBackBtn');
    const wizardForm = document.getElementById('wizardForm');

    if (nextBtn) {
        nextBtn.onclick = () => {
            if (validateCurrentStep()) {
                if (currentWizardStep < TOTAL_WIZARD_STEPS) {
                    goToWizardStep(currentWizardStep + 1);
                }
            }
        };
    }

    if (backBtn) {
        backBtn.onclick = () => {
            if (currentWizardStep > 1) {
                goToWizardStep(currentWizardStep - 1);
            }
        };
    }

    if (wizardForm) {
        wizardForm.onsubmit = async (e) => {
            e.preventDefault();
            await commitElectionDraft();
        };
    }
}

function goToWizardStep(step) {
    currentWizardStep = step;
    const indicator = document.getElementById('wizardStepIndicator');
    if (indicator) indicator.textContent = `${step} of ${TOTAL_WIZARD_STEPS}`;

    // Hide all panes, show target pane
    for (let i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
        const pane = document.getElementById(`wizardPane${i}`);
        const bar = document.getElementById(`wBar${i}`);
        if (pane) {
            if (i === step) pane.classList.remove('hidden');
            else pane.classList.add('hidden');
        }
        if (bar) {
            bar.style.background = i <= step ? 'var(--primary)' : 'var(--border)';
        }
    }

    // Button states
    const backBtn = document.getElementById('wBackBtn');
    const nextBtn = document.getElementById('wNextBtn');
    const submitBtn = document.getElementById('wSubmitDraftBtn');

    if (backBtn) backBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
    if (nextBtn && submitBtn) {
        if (step === TOTAL_WIZARD_STEPS) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }

    // Update review pane if step 6
    if (step === 6) {
        updateReviewPane();
    }
}

function validateCurrentStep() {
    if (currentWizardStep === 1) {
        const title = document.getElementById('wTitle')?.value.trim();
        const code = document.getElementById('wCode')?.value.trim();
        if (!title) {
            showToast('Official Election Title is required', 'error');
            return false;
        }
        if (!code) {
            showToast('Election Reference Code is required', 'error');
            return false;
        }
    } else if (currentWizardStep === 5) {
        const start = document.getElementById('wStartDate')?.value;
        const end = document.getElementById('wEndDate')?.value;
        if (!start || !end) {
            showToast('Start and End dates are required', 'error');
            return false;
        }
        if (new Date(end) <= new Date(start)) {
            showToast('End date must be strictly after the start date', 'error');
            return false;
        }
    }
    return true;
}

function updateReviewPane() {
    const title = document.getElementById('wTitle')?.value.trim() || '-';
    const code = document.getElementById('wCode')?.value.trim() || '-';
    const type = document.getElementById('wType')?.value || '-';
    const jurisdictionSel = document.getElementById('wJurisdiction');
    const jurisdictionText = jurisdictionSel?.options[jurisdictionSel.selectedIndex]?.text || 'National Territory';
    const start = document.getElementById('wStartDate')?.value || '-';
    const end = document.getElementById('wEndDate')?.value || '-';

    const revTitle = document.getElementById('revTitle');
    const revCode = document.getElementById('revCode');
    const revType = document.getElementById('revType');
    const revJurisdiction = document.getElementById('revJurisdiction');
    const revSchedule = document.getElementById('revSchedule');

    if (revTitle) revTitle.textContent = title;
    if (revCode) revCode.textContent = code;
    if (revType) revType.textContent = type;
    if (revJurisdiction) revJurisdiction.textContent = jurisdictionText;
    if (revSchedule) revSchedule.textContent = `${start} to ${end}`;
}

async function commitElectionDraft() {
    const submitBtn = document.getElementById('wSubmitDraftBtn');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const payload = {
            title: document.getElementById('wTitle')?.value.trim(),
            electionCode: document.getElementById('wCode')?.value.trim(),
            description: document.getElementById('wDescription')?.value.trim(),
            electionType: document.getElementById('wType')?.value,
            jurisdictionId: document.getElementById('wJurisdiction')?.value || undefined,
            startDate: document.getElementById('wStartDate')?.value,
            endDate: document.getElementById('wEndDate')?.value,
            publishLiveTally: document.getElementById('wPublishLiveTally')?.checked || false,
            configuration: {
                allowBiometricVerification: true,
                maxBallotChoices: parseInt(document.getElementById('wMaxChoices')?.value, 10) || 1,
                requireTwoPersonGovernance: true,
            }
        };

        const res = await fetch('/api/admin/elections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create election draft');

        // If Auto-accredit all registered citizens is checked
        const autoAccredit = document.getElementById('wAccreditAllCitizens')?.checked;
        if (autoAccredit && data.election && data.election._id) {
            await fetch(`/api/admin/elections/${data.election._id}/eligibility`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ enrollAllRegistered: true })
            }).catch(() => {});
        }

        showToast(`Election draft '${payload.title}' created successfully in DRAFT phase!`, 'success');
        document.getElementById('createElectionModal')?.classList.add('hidden');
        await loadElections();
    } catch (err) {
        showToast(err.message || 'Failed to commit draft election', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
