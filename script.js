const API_BASE_URL = '/api';

// --- Initialization Functions ---

const initStudentForm = () => {
    const studentForm = document.getElementById('studentFormData');
    if (!studentForm) return;

    studentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

            const bookingOpen = await fetchData('/settings/bookingOpen');
            if (bookingOpen === false) {
                showMessage('Admit card booking is currently closed. Please contact admin.', 'error');
                return;
            }
            
            const examDetails = await fetchData('/exam-details');
            if (!examDetails) {
                showMessage('No exam details available. Please contact admin to setup exams first.', 'error');
                return;
            }
            
            const formData = {
                name: document.getElementById('studentName').value,
                rollNumber: document.getElementById('rollNumber').value,
                regNumber: document.getElementById('regNumber').value,
                mobileNumber: document.getElementById('mobileNumber').value,
                email: document.getElementById('emailAddress').value
            };
            
            const result = await postData('/applications', formData);
            if (result && result._id) {
                this.reset();
                showMessage('you are sumbit is complete wait for the acadamic clearence detalis ', 'success');
                setTimeout(() => showPage('mainPage'), 3000);
            } else {
                showMessage('Error: ' + (result ? (result.message || 'Registration number already exists.') : 'Server unreachable'), 'error');
            }
        } catch (err) {
            console.error('Submission error:', err);
            showMessage('Error: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
};

const initAdminLogin = () => {
    const adminForm = document.getElementById('adminLoginForm');
    if (!adminForm) return;

    adminForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('adminUser').value.trim();
        const password = document.getElementById('adminPass').value.trim();
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

            const result = await postData('/admin-login', { username, password });
            
            if (result === null) {
                alert('Connection Error: Could not reach the server. Please make sure the server is running (npm start).');
                return;
            }

            if (result && result.success) {
                localStorage.setItem('adminLoggedIn', 'true');
                showPage('adminDashboard');
            } else {
                let msg = 'Invalid credentials! Please check your username and password.';
                if (result.debug) {
                    msg += `\n(Debug: User Match: ${result.debug.userMatch}, Pass Match: ${result.debug.passMatch})`;
                }
                alert(msg);
            }
        } catch (err) {
            alert('Login error: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
};

const initExamSetup = () => {
    const examForm = document.getElementById('examSetupForm');
    if (!examForm) return;

    examForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Saving exam details...');
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            // Upload Logo if exists
            let logoUrl = null;
            const logoInput = document.getElementById('uniLogoInput');
            if (logoInput && logoInput.files[0]) {
                const formData = new FormData();
                formData.append('logo', logoInput.files[0]);
                const uploadRes = await fetch(`${API_BASE_URL}/upload-logo`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) logoUrl = uploadData.logoUrl;
            }

            // Upload Signature if exists
            let sigUrl = null;
            const sigInput = document.getElementById('controllerSigInput');
            if (sigInput && sigInput.files[0]) {
                const formData = new FormData();
                formData.append('signature', sigInput.files[0]);
                const uploadRes = await fetch(`${API_BASE_URL}/upload-signature`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) sigUrl = uploadData.sigUrl; 
            }

            const examDetails = {
                uniName: document.getElementById('uniName').value,
                semester: document.getElementById('semester').value,
                centre: document.getElementById('centre').value,
                program: document.getElementById('program').value,
                exams: []
            };
            
            const numExams = parseInt(document.getElementById('numExams').value);
            for (let i = 0; i < numExams; i++) {
                examDetails.exams.push({
                    subjectName: document.getElementById(`subjectName_${i}`).value,
                    subjectCode: document.getElementById(`subjectCode_${i}`).value,
                    date: document.getElementById(`examDate_${i}`).value,
                    startTime: document.getElementById(`startTime_${i}`).value,
                    endTime: document.getElementById(`endTime_${i}`).value,
                    reportingTime: document.getElementById(`reportingTime_${i}`).value
                });
            }
            
            const result = await postData('/exam-details', examDetails);
            if (result) {
                alert('Exam details saved successfully!');
            } else {
                alert('Failed to save exam details. Check server connection.');
            }
        } catch (err) {
            console.error('Exam setup error:', err);
            alert('Error: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
};

const initDownloadForm = () => {
    const downloadForm = document.getElementById('downloadForm');
    if (!downloadForm) return;

    downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const regNumber = document.getElementById('downloadRegNum').value;
        const password = document.getElementById('downloadPassword').value;
        const expectedPassword = `${regNumber}@nist`;
        
        if (password !== expectedPassword) {
            alert('Invalid password!');
            return;
        }
        
        try {
            const applications = await fetchData('/applications');
            const application = (applications || []).find(app => app.regNumber === regNumber && app.status === 'approved');
            
            if (!application) {
                alert('Admit card not found or not approved yet!');
                return;
            }
            
            const examDetails = await fetchData('/exam-details');
            if (!examDetails) {
                alert('Exam details not found! Please contact admin.');
                return;
            }

            const uniLogo = await fetchData('/settings/uniLogo');
            const controllerSig = await fetchData('/settings/controllerSig');
            const admitCard = {
                studentName: application.name,
                regNumber: application.regNumber,
                rollNumber: application.rollNumber,
                admitCardNumber: `NIST/26/${application.regNumber.slice(-3)}`,
                semester: examDetails.semester,
                program: examDetails.program,
                centre: examDetails.centre,
                exams: examDetails.exams,
                uniLogo: uniLogo,
                controllerSig: controllerSig,
                generatedDate: new Date().toLocaleString()
            };
            
            showAdmitCardModal(admitCard);
        } catch (err) {
            alert('Download error: ' + err.message);
        }
    });
};

// --- Core App Logic ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log('App Initializing...');
    initStudentForm();
    initAdminLogin();
    initExamSetup();
    initDownloadForm();
    
    await updateBookingStatus();
    await checkAdminLogin();
    generateExamFields();
    
    const adminDashboard = document.getElementById('adminDashboard');
    if (adminDashboard && adminDashboard.classList.contains('active')) {
        await updateApplicationsList();
        await loadExamDetails();
    }
});

async function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'adminDashboard') {
        await updateApplicationsList();
        await updateBookingStatus();
        await loadExamDetails();
    } else if (pageId === 'mainPage') {
        await updateBookingStatus();
    }
}

function showAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (window.event) {
        window.event.target.classList.add('active');
    }
}

// --- API Helpers ---

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error('Fetch error:', err);
        return null;
    }
}

async function postData(endpoint, data, method = 'POST') {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.error('Post error:', err);
        return null;
    }
}

// --- Admin Actions ---

async function updateApplicationsList() {
    const applications = await fetchData('/applications');
    const container = document.getElementById('applicationsList');
    if (!container) return;
    
    if (!applications || applications.length === 0) {
        container.innerHTML = '<p>No applications found.</p>';
        return;
    }
    
    container.innerHTML = applications.map(app => `
        <div class="application-item">
            <h4>${app.name}</h4>
            <p><strong>Reg No:</strong> ${app.regNumber} | <strong>Roll:</strong> ${app.rollNumber}</p>
            <p><strong>Status:</strong> <span class="status ${app.status}">${app.status.toUpperCase()}</span></p>
            <div class="application-actions">
                ${app.status === 'pending' ? `
                    <button class="btn-approve" onclick="handleApplication('${app._id}', 'approved')">Approve</button>
                    <button class="btn-reject" onclick="handleApplication('${app._id}', 'rejected')">Reject</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function handleApplication(appId, status) {
    const result = await postData(`/applications/${appId}`, { status }, 'PATCH');
    if (result) await updateApplicationsList();
}

async function toggleBookingStatus() {
    const isOpen = document.getElementById('bookingOpen').checked;
    await postData('/settings', { key: 'bookingOpen', value: isOpen });
    await updateBookingStatus();
}

async function updateBookingStatus() {
    const isOpen = await fetchData('/settings/bookingOpen');
    const checkbox = document.getElementById('bookingOpen');
    if (checkbox) checkbox.checked = isOpen !== false;
    
    const msg = document.getElementById('formMessage');
    if (msg) {
        msg.innerHTML = isOpen === false ? '<div class="message error">Admit card booking is closed.</div>' : '';
    }
}

async function clearAllData() {
    if (confirm('Clear all data?')) {
        await postData('/clear-all', {});
        location.reload();
    }
}

async function loadExamDetails() {
    try {
        const details = await fetchData('/exam-details');
        const logo = await fetchData('/settings/uniLogo');
        const sig = await fetchData('/settings/controllerSig');
        
        // Load Logo Preview
        if (logo) {
            const container = document.getElementById('logoPreviewContainer');
            if (container) {
                container.innerHTML = `<img src="${logo}" style="width: 50px; height: auto; border-radius: 5px;" alt="Logo">`;
            }
        }

        // Load Signature Preview
        if (sig) {
            const container = document.getElementById('sigPreviewContainer');
            if (container) {
                container.innerHTML = `<img src="${sig}" style="width: 50px; height: auto; border-radius: 5px;" alt="Signature">`;
            }
        }

        if (details) {
            // Populate Basic Details
            const fields = ['semester', 'centre', 'program'];
            fields.forEach(field => {
                const el = document.getElementById(field);
                if (el && details[field]) el.value = details[field];
            });

            if (details.exams && details.exams.length > 0) {
                const numExamsEl = document.getElementById('numExams');
                if (numExamsEl) {
                    numExamsEl.value = details.exams.length;
                    generateExamFields(); // Create the rows

                    // Fill the rows
                    details.exams.forEach((exam, i) => {
                        if (document.getElementById(`subjectName_${i}`)) {
                            document.getElementById(`subjectName_${i}`).value = exam.subjectName || '';
                            document.getElementById(`subjectCode_${i}`).value = exam.subjectCode || '';
                            document.getElementById(`examDate_${i}`).value = exam.date || '';
                            document.getElementById(`startTime_${i}`).value = exam.startTime || '';
                            document.getElementById(`endTime_${i}`).value = exam.endTime || '';
                            document.getElementById(`reportingTime_${i}`).value = exam.reportingTime || '';
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error loading exam details:', err);
    }
}

// --- UI Helpers ---

function generateExamFields() {
    const num = parseInt(document.getElementById('numExams').value) || 0;
    const container = document.getElementById('examFields');
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < num; i++) {
        const div = document.createElement('div');
        div.className = 'form-row';
        div.innerHTML = `
            <div class="form-group">
                <label>Subject ${i+1}</label>
                <input type="text" id="subjectName_${i}" required>
            </div>
            <div class="form-group">
                <label>Code ${i+1}</label>
                <input type="text" id="subjectCode_${i}" required>
            </div>
            <div class="form-group">
                <label>Date ${i+1}</label>
                <input type="date" id="examDate_${i}" required>
            </div>
            <div class="form-group">
                <label>Start Time ${i+1}</label>
                <input type="time" id="startTime_${i}" required>
            </div>
            <div class="form-group">
                <label>End Time ${i+1}</label>
                <input type="time" id="endTime_${i}" required>
            </div>
            <div class="form-group">
                <label>Reporting ${i+1}</label>
                <input type="time" id="reportingTime_${i}" required>
            </div>
        `;
        container.appendChild(div);
    }
}

function previewLogo(input) {
    const container = document.getElementById('logoPreviewContainer');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            container.innerHTML = `<img src="${e.target.result}" style="width: 50px; height: auto; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewSignature(input) {
    const container = document.getElementById('sigPreviewContainer');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            container.innerHTML = `<img src="${e.target.result}" style="width: 50px; height: auto; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function showAdmitCardModal(card) {
    const examsTable = card.exams.map(e => `
        <tr>
            <td>${e.subjectName}</td>
            <td>${e.subjectCode}</td>
            <td>${e.date}</td>
            <td>${e.startTime || ''} - ${e.endTime || ''}</td>
            <td>${e.reportingTime || 'N/A'}</td>
            <td class="signature-col"></td>
        </tr>
    `).join('');
    
    const logoHtml = card.uniLogo ? `<img src="${card.uniLogo}" class="admit-logo" alt="Logo">` : '';
    const sigHtml = card.controllerSig ? `<img src="${card.controllerSig}" class="controller-sig-img" alt="Signature">` : '';

    document.getElementById('admitCardContent').innerHTML = `
        <div class="admit-card">
            <div class="university-header">
                <div class="header-content">
                    ${logoHtml}
                    <div class="header-text">
                        <h1>NIST UNIVERSITY, BERHAMPUR</h1>
                        <p>Formerly National Institute of Science and Technology (Autonomous)</p>
                        <p>Pallur Hills, Berhampur - 761008, Odisha</p>
                    </div>
                </div>
            </div>
            
            <h2 class="main-title">EXAM ADMIT CARD</h2>
            
            <div class="student-info-grid">
                <div class="info-item"><strong>Student Name:</strong> <span>${card.studentName}</span></div>
                <div class="info-item"><strong>Registration No:</strong> <span>${card.regNumber}</span></div>
                <div class="info-item"><strong>Program:</strong> <span>${card.program || 'N/A'}</span></div>
                <div class="info-item"><strong>Semester:</strong> <span>${card.semester}</span></div>
                <div class="info-item"><strong>Centre:</strong> <span>${card.centre || 'NIST University'}</span></div>
            </div>
            
            <div class="exam-schedule">
                <table class="admit-table">
                    <thead>
                        <tr>
                            <th>Subject Name</th>
                            <th>Subject Code</th>
                            <th>Date of Exam</th>
                            <th>Exam Time</th>
                            <th>Reporting Time</th>
                            <th>Invigilator Signature</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${examsTable}
                    </tbody>
                </table>
            </div>
            
            <div class="guidelines-section">
                <h3>Guidelines for the Student</h3>
                <ol class="guidelines-list">
                    <li>All students must read instructions and fill all columns in the answer booklet.</li>
                    <li>Enter the exam hall 30 minutes before the exam starts.</li>
                    <li>Do not bring any items except pen/pencil/non-programmable calculator and admit card.</li>
                    <li>Mobile phones are strictly not allowed (even in switch-off mode).</li>
                    <li>No talking during the exam. Raise your hand if you have doubts.</li>
                    <li>Do not leave the hall within 1 hour of exam start.</li>
                    <li>Submit answer booklet before leaving.</li>
                    <li>Students leaving before 2:30 must submit question paper and answer booklet.</li>
                </ol>
            </div>

            <div class="admit-footer">
                <div class="sig-placeholder">
                    ${sigHtml}
                    <p>_______________________</p>
                    <p>Controller of Examinations</p>
                </div>
                <div class="sig-placeholder">
                    <p>_______________________</p>
                    <p>Student Signature</p>
                </div>
            </div>
        </div>
    `;
    document.getElementById('admitCardModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('admitCardModal').style.display = 'none';
}

function showMessage(message, type = 'info') {
    const msgDiv = document.getElementById('formMessage');
    if (!msgDiv) return;
    msgDiv.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => { msgDiv.innerHTML = ''; }, 5000);
}

function checkAdminLogin() {
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        const active = document.querySelector('.page.active');
        if (active && active.id === 'adminLogin') showPage('adminDashboard');
    }
}

function logoutAdmin() {
    localStorage.removeItem('adminLoggedIn');
    showPage('mainPage');
}

window.onclick = (e) => {
    const modal = document.getElementById('admitCardModal');
    if (e.target == modal) closeModal();
};

function printAdmitCard() {
    window.print();
}

async function downloadPDF() {
    const element = document.getElementById('admitCardContent');
    const opt = {
        margin: 0,
        filename: 'admit_card.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(element).save();
    } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('Failed to generate PDF. You can try using the Print button instead.');
    }
}