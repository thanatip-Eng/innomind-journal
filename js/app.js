// =====================================================
// EL Daily Journal - Main Application
// =====================================================

// Global State
let currentUser = null;
let currentUserRole = null;
let currentUserData = null;
let currentEvent = null;
let selectedDate = null;
let selectedFiles = [];
let viewingStudent = null;
let allEvents = [];
let calendarDate = new Date();

// =====================================================
// Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            
            if (currentUserData && currentUserData.needsPasswordSetup) {
                showSetPasswordPage();
            } else {
                await loadCurrentEvent();
                await loadAllEvents();
                navigateToRoleDashboard();
            }
        } else {
            currentUser = null;
            currentUserRole = null;
            currentUserData = null;
            showPage('login-page');
        }
        hideLoading();
    });
    
    setupEventListeners();
}

function setupEventListeners() {
    // Forms
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('set-password-form')?.addEventListener('submit', handleSetPassword);
    document.getElementById('journal-form')?.addEventListener('submit', handleJournalSubmit);
    document.getElementById('community-note-form')?.addEventListener('submit', handleCommunityNoteSubmit);
    
    // Logout buttons
    document.getElementById('admin-logout')?.addEventListener('click', handleLogout);
    document.getElementById('teacher-logout')?.addEventListener('click', handleLogout);
    document.getElementById('student-logout')?.addEventListener('click', handleLogout);
    document.getElementById('student-detail-logout')?.addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab) switchTab(e.currentTarget, tab);
        });
    });
    
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab) switchSidebarTab(e.currentTarget, tab);
        });
    });
    
    // File upload
    document.getElementById('journal-files')?.addEventListener('change', handleFileSelect);
    document.getElementById('journal-file-area')?.addEventListener('click', () => {
        document.getElementById('journal-files')?.click();
    });
    
    // Calendar
    document.getElementById('prev-month')?.addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('next-month')?.addEventListener('click', () => navigateCalendar(1));
    
    // Star ratings
    setupStarRatings();
    
    // Modal
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function setupStarRatings() {
    // Use event delegation for star ratings
    document.addEventListener('click', (e) => {
        const star = e.target.closest('.star-rating i');
        if (!star) return;
        
        const rating = star.closest('.star-rating');
        const value = parseInt(star.dataset.value);
        
        // Update visual state
        rating.querySelectorAll('i').forEach((s, i) => {
            if (i < value) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
        
        // Store rating value
        rating.dataset.rating = value;
    });
    
    // Hover effect
    document.addEventListener('mouseover', (e) => {
        const star = e.target.closest('.star-rating i');
        if (!star) return;
        
        const rating = star.closest('.star-rating');
        const value = parseInt(star.dataset.value);
        
        rating.querySelectorAll('i').forEach((s, i) => {
            if (i < value) {
                s.classList.add('hover');
            } else {
                s.classList.remove('hover');
            }
        });
    });
    
    document.addEventListener('mouseout', (e) => {
        const star = e.target.closest('.star-rating i');
        if (!star) return;
        
        const rating = star.closest('.star-rating');
        rating.querySelectorAll('i').forEach(s => {
            s.classList.remove('hover');
        });
    });
}

// =====================================================
// Authentication
// =====================================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    showLoading();
    errorDiv.textContent = '';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' 
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' 
            : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
        hideLoading();
    }
}

async function handleSetPassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorDiv = document.getElementById('set-password-error');
    
    errorDiv.textContent = '';
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'รหัสผ่านไม่ตรงกัน';
        return;
    }
    if (newPassword.length < 6) {
        errorDiv.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
        return;
    }
    
    showLoading();
    
    try {
        await currentUser.updatePassword(newPassword);
        const collection = currentUserRole === 'teacher' ? 'teachers' : 'students';
        await db.collection(collection).doc(currentUser.uid).update({ needsPasswordSetup: false });
        currentUserData.needsPasswordSetup = false;
        
        showToast('ตั้งรหัสผ่านสำเร็จ', 'success');
        await loadCurrentEvent();
        await loadAllEvents();
        navigateToRoleDashboard();
    } catch (error) {
        errorDiv.textContent = 'เกิดข้อผิดพลาด: ' + error.message;
    }
    hideLoading();
}

function showSetPasswordPage() {
    document.getElementById('set-password-email').value = currentUser.email;
    showPage('set-password-page');
}

async function handleLogout() {
    try { await auth.signOut(); } catch (e) { console.error(e); }
}

// =====================================================
// User Data Loading
// =====================================================

async function loadUserData() {
    if (!currentUser) return;
    
    // Check admin
    try {
        const adminDoc = await db.collection('admins').doc(currentUser.uid).get();
        if (adminDoc.exists) {
            currentUserRole = 'admin';
            currentUserData = adminDoc.data();
            return;
        }
    } catch (e) {}
    
    // Check teacher
    try {
        const teacherDoc = await db.collection('teachers').doc(currentUser.uid).get();
        if (teacherDoc.exists) {
            currentUserRole = 'teacher';
            currentUserData = teacherDoc.data();
            return;
        }
    } catch (e) {}
    
    // Check student
    try {
        const studentDoc = await db.collection('students').doc(currentUser.uid).get();
        if (studentDoc.exists) {
            currentUserRole = 'student';
            currentUserData = studentDoc.data();
            return;
        }
    } catch (e) {}
    
    currentUserRole = null;
    currentUserData = null;
}

async function loadCurrentEvent() {
    try {
        const today = getDateString(new Date());
        const snapshot = await db.collection('events')
            .where('startDate', '<=', today)
            .where('endDate', '>=', today)
            .limit(1).get();
        
        if (!snapshot.empty) {
            currentEvent = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } else {
            const latest = await db.collection('events').orderBy('endDate', 'desc').limit(1).get();
            if (!latest.empty) {
                currentEvent = { id: latest.docs[0].id, ...latest.docs[0].data() };
            }
        }
    } catch (e) { console.error(e); }
}

async function loadAllEvents() {
    try {
        const snapshot = await db.collection('events').orderBy('startDate', 'desc').get();
        allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { console.error(e); }
}

// =====================================================
// Navigation
// =====================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
}

function navigateToRoleDashboard() {
    switch (currentUserRole) {
        case 'admin': showPage('admin-page'); loadAdminDashboard(); break;
        case 'teacher': showPage('teacher-page'); loadTeacherDashboard(); break;
        case 'student': showPage('student-page'); loadStudentDashboard(); break;
        default: showPage('login-page');
    }
}

function switchTab(button, tabId) {
    button.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    const page = button.closest('.page');
    page.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    // Load data
    if (tabId === 'student-journal') loadJournalForDate(selectedDate || getDateString(new Date()));
    else if (tabId === 'student-history') loadJournalHistory();
    else if (tabId === 'student-community') loadCommunityNotes();
    else if (tabId === 'student-journey') loadLearningJourney();
}

function switchSidebarTab(button, tabId) {
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    const page = button.closest('.page');
    page.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    if (tabId === 'admin-stats') loadAdminStats();
}

// =====================================================
// Admin Dashboard
// =====================================================

async function loadAdminDashboard() {
    await Promise.all([loadStudentsTable(), loadTeachersTable(), loadGroups(), loadEvents()]);
}

async function loadStudentsTable() {
    const tbody = document.getElementById('students-table');
    if (!tbody) return;
    
    try {
        const [studentsSnap, groupsSnap, eventsSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('groups').get(),
            db.collection('events').get()
        ]);
        
        if (studentsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">ยังไม่มีนักศึกษาในระบบ</td></tr>';
            return;
        }
        
        const groups = {}, events = {};
        groupsSnap.forEach(d => groups[d.id] = d.data().name);
        eventsSnap.forEach(d => events[d.id] = d.data().name);
        
        tbody.innerHTML = studentsSnap.docs.map(doc => {
            const d = doc.data();
            const status = d.needsPasswordSetup 
                ? '<span class="badge badge-warning">รอตั้งรหัส</span>'
                : '<span class="badge badge-success">ใช้งาน</span>';
            return `<tr>
                <td>${d.email}</td>
                <td>${d.name || '-'}</td>
                <td>${groups[d.groupId] || '<span style="color:var(--text-muted);">-</span>'}</td>
                <td>${events[d.eventId] || '<span style="color:var(--text-muted);">-</span>'}</td>
                <td>${status}</td>
                <td><div class="flex gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="editUser('student','${doc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('student','${doc.id}')"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--error);">เกิดข้อผิดพลาด</td></tr>';
    }
}

async function loadTeachersTable() {
    const tbody = document.getElementById('teachers-table');
    if (!tbody) return;
    
    try {
        const [teachersSnap, groupsSnap] = await Promise.all([
            db.collection('teachers').get(),
            db.collection('groups').get()
        ]);
        
        if (teachersSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">ยังไม่มีอาจารย์ในระบบ</td></tr>';
            return;
        }
        
        const groups = {};
        groupsSnap.forEach(d => {
            const data = d.data();
            if (data.teacherId) {
                if (!groups[data.teacherId]) groups[data.teacherId] = [];
                groups[data.teacherId].push(data.name);
            }
        });
        
        tbody.innerHTML = teachersSnap.docs.map(doc => {
            const d = doc.data();
            const tGroups = groups[doc.id] || [];
            const status = d.needsPasswordSetup ? ' <span class="badge badge-warning">รอตั้งรหัส</span>' : '';
            return `<tr>
                <td>${d.email}${status}</td>
                <td>${d.name || '-'}</td>
                <td>${tGroups.join(', ') || '<span style="color:var(--text-muted);">-</span>'}</td>
                <td><div class="flex gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="editUser('teacher','${doc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('teacher','${doc.id}')"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadGroups() {
    const container = document.getElementById('groups-container');
    if (!container) return;
    
    try {
        const [groupsSnap, teachersSnap] = await Promise.all([
            db.collection('groups').get(),
            db.collection('teachers').get()
        ]);
        
        if (groupsSnap.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">📁</div><h3>ยังไม่มีกลุ่ม</h3></div>';
            return;
        }
        
        const teachers = {};
        teachersSnap.forEach(d => teachers[d.id] = d.data().name || d.data().email);
        
        container.innerHTML = groupsSnap.docs.map(doc => {
            const d = doc.data();
            return `<div class="card group-card">
                <div class="card-body">
                    <h3 style="font-family:var(--font-display);margin-bottom:0.5rem;">${d.name}</h3>
                    <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1rem;">
                        <i class="fas fa-chalkboard-teacher"></i> ${teachers[d.teacherId] || 'ยังไม่ระบุ'}
                    </p>
                    <div class="flex gap-1">
                        <button class="btn btn-secondary btn-sm" onclick="editGroup('${doc.id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteGroup('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('events').orderBy('startDate', 'desc').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">📅</div><h3>ยังไม่มีอีเวนท์</h3></div>';
            return;
        }
        
        const today = getDateString(new Date());
        container.innerHTML = snapshot.docs.map(doc => {
            const d = doc.data();
            let statusText = 'กำลังจะมาถึง', statusClass = 'badge-info';
            if (today >= d.startDate && today <= d.endDate) { statusText = 'กำลังดำเนินการ'; statusClass = 'badge-success'; }
            else if (today > d.endDate) { statusText = 'สิ้นสุดแล้ว'; statusClass = 'badge-warning'; }
            
            return `<div class="card mb-2">
                <div class="card-body">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                        <div>
                            <h3 style="font-family:var(--font-display);margin-bottom:0.25rem;">${d.name}</h3>
                            <p style="color:var(--text-muted);font-size:0.875rem;"><i class="fas fa-calendar"></i> ${formatDateThai(d.startDate)} - ${formatDateThai(d.endDate)}</p>
                            ${d.description ? `<p style="margin-top:0.5rem;color:var(--text-secondary);">${d.description}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="badge ${statusClass}">${statusText}</span>
                            <button class="btn btn-secondary btn-sm" onclick="editEvent('${doc.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="deleteEvent('${doc.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadAdminStats() {
    try {
        const studentsSnap = await db.collection('students').get();
        document.getElementById('stat-total-students').textContent = studentsSnap.size;
    } catch (e) { console.error(e); }
}

// =====================================================
// Edit Functions (Admin)
// =====================================================

async function editUser(type, userId) {
    try {
        const collection = type === 'teacher' ? 'teachers' : 'students';
        const doc = await db.collection(collection).doc(userId).get();
        if (!doc.exists) { showToast('ไม่พบข้อมูล', 'error'); return; }
        
        const data = doc.data();
        const [groupsSnap, eventsSnap] = await Promise.all([
            db.collection('groups').get(),
            db.collection('events').get()
        ]);
        
        // For students - dropdown options
        const groupOpts = groupsSnap.docs.map(g => 
            `<option value="${g.id}" ${data.groupId === g.id ? 'selected' : ''}>${g.data().name}</option>`
        ).join('');
        
        const eventOpts = eventsSnap.docs.map(e => 
            `<option value="${e.id}" ${data.eventId === e.id ? 'selected' : ''}>${e.data().name}</option>`
        ).join('');
        
        // For teachers - checkboxes for groups they manage
        const teacherGroupCheckboxes = groupsSnap.docs.map(g => {
            const gData = g.data();
            const isManaged = gData.teacherId === userId;
            return `<label class="flex items-center gap-2" style="cursor:pointer;padding:0.5rem;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:0.25rem;">
                <input type="checkbox" class="teacher-group-checkbox" value="${g.id}" ${isManaged ? 'checked' : ''} style="width:18px;height:18px;">
                <span>${gData.name}</span>
            </label>`;
        }).join('');
        
        document.getElementById('modal-container').innerHTML = `
            <div class="modal-header">
                <h3>แก้ไขข้อมูล${type === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="edit-user-form" class="flex flex-col gap-2">
                    <input type="hidden" id="edit-user-id" value="${userId}">
                    <input type="hidden" id="edit-user-type" value="${type}">
                    <div class="form-group">
                        <label>อีเมล</label>
                        <input type="email" value="${data.email || ''}" disabled style="background:var(--bg-secondary);">
                    </div>
                    <div class="form-group">
                        <label>ชื่อ-นามสกุล</label>
                        <input type="text" id="edit-user-name" value="${data.name || ''}" required>
                    </div>
                    ${type === 'student' ? `
                    <div class="form-group">
                        <label>กลุ่ม</label>
                        <select id="edit-user-group" class="form-select">
                            <option value="">-- ไม่ระบุ --</option>
                            ${groupOpts}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>อีเวนท์</label>
                        <select id="edit-user-event" class="form-select">
                            <option value="">-- ไม่ระบุ --</option>
                            ${eventOpts}
                        </select>
                    </div>
                    ` : `
                    <div class="form-group">
                        <label>กลุ่มที่ดูแล</label>
                        <div id="teacher-groups-list" style="max-height:200px;overflow-y:auto;">
                            ${teacherGroupCheckboxes || '<p style="color:var(--text-muted);font-size:0.875rem;">ยังไม่มีกลุ่มในระบบ</p>'}
                        </div>
                    </div>
                    `}
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" onclick="saveEditUser()">บันทึก</button>
            </div>
        `;
        document.getElementById('modal-overlay').classList.add('active');
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function saveEditUser() {
    const userId = document.getElementById('edit-user-id').value;
    const type = document.getElementById('edit-user-type').value;
    const name = document.getElementById('edit-user-name').value.trim();
    
    if (!name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
    
    showLoading();
    
    try {
        const collection = type === 'teacher' ? 'teachers' : 'students';
        const updateData = { name };
        
        if (type === 'student') {
            updateData.groupId = document.getElementById('edit-user-group')?.value || null;
            updateData.eventId = document.getElementById('edit-user-event')?.value || null;
        }
        
        // Update user document
        await db.collection(collection).doc(userId).update(updateData);
        
        // For teachers, update group assignments
        if (type === 'teacher') {
            const checkboxes = document.querySelectorAll('.teacher-group-checkbox');
            const selectedGroupIds = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            // Get all groups
            const groupsSnap = await db.collection('groups').get();
            
            // Update each group's teacherId
            const batch = db.batch();
            groupsSnap.docs.forEach(doc => {
                const groupRef = db.collection('groups').doc(doc.id);
                if (selectedGroupIds.includes(doc.id)) {
                    // Assign this teacher to this group
                    batch.update(groupRef, { teacherId: userId });
                } else if (doc.data().teacherId === userId) {
                    // Remove this teacher from this group (only if it was assigned to this teacher)
                    batch.update(groupRef, { teacherId: null });
                }
            });
            await batch.commit();
        }
        
        showToast('บันทึกสำเร็จ', 'success');
        closeModal();
        
        if (type === 'teacher') {
            loadTeachersTable();
            loadGroups();
        } else {
            loadStudentsTable();
        }
    } catch (e) { 
        console.error(e); 
        showToast('เกิดข้อผิดพลาด', 'error'); 
    }
    
    hideLoading();
}

async function deleteUser(type, userId) {
    if (!confirm('ต้องการลบผู้ใช้นี้?')) return;
    try {
        await db.collection(type === 'teacher' ? 'teachers' : 'students').doc(userId).delete();
        showToast('ลบสำเร็จ', 'success');
        type === 'teacher' ? loadTeachersTable() : loadStudentsTable();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function editGroup(groupId) {
    try {
        const doc = await db.collection('groups').doc(groupId).get();
        if (!doc.exists) { showToast('ไม่พบข้อมูล', 'error'); return; }
        
        const data = doc.data();
        const teachersSnap = await db.collection('teachers').get();
        const teacherOpts = teachersSnap.docs.map(t => 
            `<option value="${t.id}" ${data.teacherId === t.id ? 'selected' : ''}>${t.data().name || t.data().email}</option>`
        ).join('');
        
        document.getElementById('modal-container').innerHTML = `
            <div class="modal-header">
                <h3>แก้ไขกลุ่ม</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <form class="flex flex-col gap-2">
                    <input type="hidden" id="edit-group-id" value="${groupId}">
                    <div class="form-group">
                        <label>ชื่อกลุ่ม</label>
                        <input type="text" id="edit-group-name" value="${data.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>อาจารย์ที่ดูแล</label>
                        <select id="edit-group-teacher" class="form-select">
                            <option value="">-- เลือกอาจารย์ --</option>
                            ${teacherOpts}
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" onclick="saveEditGroup()">บันทึก</button>
            </div>
        `;
        document.getElementById('modal-overlay').classList.add('active');
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function saveEditGroup() {
    const groupId = document.getElementById('edit-group-id').value;
    const name = document.getElementById('edit-group-name').value.trim();
    const teacherId = document.getElementById('edit-group-teacher').value;
    
    if (!name) { showToast('กรุณากรอกชื่อกลุ่ม', 'error'); return; }
    
    try {
        await db.collection('groups').doc(groupId).update({ name, teacherId: teacherId || null });
        showToast('บันทึกสำเร็จ', 'success');
        closeModal();
        loadGroups();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function deleteGroup(groupId) {
    if (!confirm('ต้องการลบกลุ่มนี้?')) return;
    try {
        await db.collection('groups').doc(groupId).delete();
        showToast('ลบสำเร็จ', 'success');
        loadGroups();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function editEvent(eventId) {
    try {
        const doc = await db.collection('events').doc(eventId).get();
        if (!doc.exists) { showToast('ไม่พบข้อมูล', 'error'); return; }
        
        const data = doc.data();
        document.getElementById('modal-container').innerHTML = `
            <div class="modal-header">
                <h3>แก้ไขอีเวนท์</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <form class="flex flex-col gap-2">
                    <input type="hidden" id="edit-event-id" value="${eventId}">
                    <div class="form-group">
                        <label>ชื่ออีเวนท์</label>
                        <input type="text" id="edit-event-name" value="${data.name || ''}" required>
                    </div>
                    <div class="flex gap-2">
                        <div class="form-group" style="flex:1;">
                            <label>วันเริ่มต้น</label>
                            <input type="date" id="edit-event-start" value="${data.startDate || ''}" required>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>วันสิ้นสุด</label>
                            <input type="date" id="edit-event-end" value="${data.endDate || ''}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>รายละเอียด</label>
                        <textarea id="edit-event-desc" rows="3">${data.description || ''}</textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" onclick="saveEditEvent()">บันทึก</button>
            </div>
        `;
        document.getElementById('modal-overlay').classList.add('active');
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function saveEditEvent() {
    const eventId = document.getElementById('edit-event-id').value;
    const name = document.getElementById('edit-event-name').value.trim();
    const startDate = document.getElementById('edit-event-start').value;
    const endDate = document.getElementById('edit-event-end').value;
    const description = document.getElementById('edit-event-desc').value.trim();
    
    if (!name || !startDate || !endDate) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
    
    try {
        await db.collection('events').doc(eventId).update({ name, startDate, endDate, description });
        showToast('บันทึกสำเร็จ', 'success');
        closeModal();
        loadEvents();
        await loadAllEvents();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function deleteEvent(eventId) {
    if (!confirm('ต้องการลบอีเวนท์นี้?')) return;
    try {
        await db.collection('events').doc(eventId).delete();
        showToast('ลบสำเร็จ', 'success');
        loadEvents();
        await loadAllEvents();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

// =====================================================
// Add Modals
// =====================================================

function showAddUserModal() {
    const template = document.getElementById('add-user-modal-template');
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');
    
    loadGroupsDropdown('user-group');
    loadEventsDropdown('user-event');
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
}

async function loadGroupsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const snap = await db.collection('groups').get();
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.data().name;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function loadEventsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const snap = await db.collection('events').orderBy('startDate', 'desc').get();
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.data().name;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function handleAddUser(e) {
    e.preventDefault();
    const type = document.getElementById('user-type').value;
    const email = document.getElementById('user-email').value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;
    const groupId = document.getElementById('user-group')?.value;
    const eventId = document.getElementById('user-event')?.value;
    
    showLoading();
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const collection = type === 'teacher' ? 'teachers' : 'students';
        const userData = { email, name, createdAt: firebase.firestore.FieldValue.serverTimestamp(), needsPasswordSetup: false };
        if (type === 'student') {
            if (groupId) userData.groupId = groupId;
            if (eventId) userData.eventId = eventId;
        }
        await db.collection(collection).doc(cred.user.uid).set(userData);
        await auth.signOut();
        closeModal();
        showToast('เพิ่มผู้ใช้สำเร็จ - กรุณา login ใหม่', 'success');
        showPage('login-page');
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    hideLoading();
}

function showAddGroupModal() {
    const template = document.getElementById('add-group-modal-template');
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');
    
    loadTeachersDropdown('group-teacher');
    document.getElementById('add-group-form').addEventListener('submit', handleAddGroup);
}

async function loadTeachersDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const snap = await db.collection('teachers').get();
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.data().name || d.data().email;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function handleAddGroup(e) {
    e.preventDefault();
    const name = document.getElementById('group-name').value;
    const teacherId = document.getElementById('group-teacher').value;
    
    showLoading();
    try {
        await db.collection('groups').add({ name, teacherId: teacherId || null, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        closeModal();
        showToast('สร้างกลุ่มสำเร็จ', 'success');
        loadGroups();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
    hideLoading();
}

function showAddEventModal() {
    const template = document.getElementById('add-event-modal-template');
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');
    
    document.getElementById('add-event-form').addEventListener('submit', handleAddEvent);
}

async function handleAddEvent(e) {
    e.preventDefault();
    const name = document.getElementById('event-name').value;
    const startDate = document.getElementById('event-start').value;
    const endDate = document.getElementById('event-end').value;
    const description = document.getElementById('event-description').value;
    
    showLoading();
    try {
        await db.collection('events').add({ name, startDate, endDate, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        closeModal();
        showToast('สร้างอีเวนท์สำเร็จ', 'success');
        loadEvents();
        await loadAllEvents();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
    hideLoading();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('modal-container').innerHTML = '';
}

// =====================================================
// CSV Import/Export
// =====================================================

function downloadCSVTemplate(type) {
    let csv = '', filename = '';
    if (type === 'users') {
        csv = 'email,name,role,group,event\n';
        csv += 'student1@example.com,ชื่อ นามสกุล,student,กลุ่ม A,ค่าย EL ครั้งที่ 1\n';
        csv += 'teacher1@example.com,อาจารย์ ชื่อ,teacher,,\n';
        filename = 'users_template.csv';
    } else if (type === 'events') {
        csv = 'name,startDate,endDate,description\n';
        csv += 'ค่าย EL ครั้งที่ 1,2025-02-01,2025-02-07,รายละเอียด\n';
        filename = 'events_template.csv';
    }
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function showImportUsersModal() {
    document.getElementById('modal-container').innerHTML = `
        <div class="modal-header">
            <h3>นำเข้าผู้ใช้จาก CSV</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>เลือกไฟล์ CSV</label>
                <input type="file" id="import-users-file" accept=".csv" class="form-control" style="padding:0.5rem;">
            </div>
            <div style="margin-top:1rem;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);font-size:0.875rem;">
                <p><strong>รูปแบบ CSV:</strong> email, name, role (student/teacher), group, event</p>
                <p style="margin-top:0.5rem;color:var(--text-muted);">* ผู้ใช้ใหม่จะต้องตั้งรหัสผ่านเมื่อ login ครั้งแรก</p>
            </div>
            <div id="import-preview" style="margin-top:1rem;max-height:200px;overflow:auto;"></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
            <button class="btn btn-primary" onclick="processUsersImport()">นำเข้า</button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('import-users-file').addEventListener('change', previewCSV);
}

function previewCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const lines = ev.target.result.split('\n');
        const preview = document.getElementById('import-preview');
        let html = '<table class="data-table" style="font-size:0.75rem;"><thead><tr>';
        lines[0].split(',').forEach(h => html += `<th>${h.trim()}</th>`);
        html += '</tr></thead><tbody>';
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
            if (lines[i].trim()) {
                html += '<tr>';
                lines[i].split(',').forEach(c => html += `<td>${c.trim()}</td>`);
                html += '</tr>';
            }
        }
        html += '</tbody></table>';
        if (lines.length > 6) html += `<p style="color:var(--text-muted);font-size:0.75rem;margin-top:0.5rem;">... และอีก ${lines.length - 6} รายการ</p>`;
        preview.innerHTML = html;
    };
    reader.readAsText(file);
}

async function processUsersImport() {
    const file = document.getElementById('import-users-file').files[0];
    if (!file) { showToast('กรุณาเลือกไฟล์', 'error'); return; }
    
    showLoading();
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const lines = ev.target.result.split('\n');
        
        // Get groups and events maps
        const [groupsSnap, eventsSnap] = await Promise.all([
            db.collection('groups').get(),
            db.collection('events').get()
        ]);
        const groups = {}, events = {};
        groupsSnap.forEach(d => groups[d.data().name] = d.id);
        eventsSnap.forEach(d => events[d.data().name] = d.id);
        
        let success = 0, fail = 0;
        const tempPw = 'temp' + Math.random().toString(36).substr(2, 8);
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const [email, name, role, groupName, eventName] = line.split(',').map(c => c.trim());
            if (!email || !role) continue;
            
            try {
                const cred = await auth.createUserWithEmailAndPassword(email, tempPw);
                const collection = role === 'teacher' ? 'teachers' : 'students';
                const userData = { email, name: name || '', createdAt: firebase.firestore.FieldValue.serverTimestamp(), needsPasswordSetup: true };
                
                if (role === 'student') {
                    if (groupName && groups[groupName]) userData.groupId = groups[groupName];
                    if (eventName && events[eventName]) userData.eventId = events[eventName];
                }
                
                await db.collection(collection).doc(cred.user.uid).set(userData);
                await auth.signOut();
                success++;
            } catch (e) { console.error('Import error:', email, e); fail++; }
        }
        
        hideLoading();
        closeModal();
        showToast(`นำเข้าสำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, success > 0 ? 'success' : 'error');
        showPage('login-page');
    };
    reader.readAsText(file);
}

function showImportEventsModal() {
    document.getElementById('modal-container').innerHTML = `
        <div class="modal-header">
            <h3>นำเข้าอีเวนท์จาก CSV</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>เลือกไฟล์ CSV</label>
                <input type="file" id="import-events-file" accept=".csv" class="form-control" style="padding:0.5rem;">
            </div>
            <div style="margin-top:1rem;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);font-size:0.875rem;">
                <p><strong>รูปแบบ CSV:</strong> name, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), description</p>
            </div>
            <div id="import-events-preview" style="margin-top:1rem;max-height:200px;overflow:auto;"></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
            <button class="btn btn-primary" onclick="processEventsImport()">นำเข้า</button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('import-events-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const lines = ev.target.result.split('\n');
            const preview = document.getElementById('import-events-preview');
            let html = '<table class="data-table" style="font-size:0.75rem;"><thead><tr>';
            lines[0].split(',').forEach(h => html += `<th>${h.trim()}</th>`);
            html += '</tr></thead><tbody>';
            for (let i = 1; i < Math.min(lines.length, 6); i++) {
                if (lines[i].trim()) {
                    html += '<tr>';
                    lines[i].split(',').forEach(c => html += `<td>${c.trim()}</td>`);
                    html += '</tr>';
                }
            }
            html += '</tbody></table>';
            preview.innerHTML = html;
        };
        reader.readAsText(file);
    });
}

async function processEventsImport() {
    const file = document.getElementById('import-events-file').files[0];
    if (!file) { showToast('กรุณาเลือกไฟล์', 'error'); return; }
    
    showLoading();
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const lines = ev.target.result.split('\n');
        let success = 0, fail = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const [name, startDate, endDate, description] = line.split(',').map(c => c.trim());
            if (!name || !startDate || !endDate) continue;
            
            try {
                await db.collection('events').add({ name, startDate, endDate, description: description || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                success++;
            } catch (e) { console.error(e); fail++; }
        }
        
        hideLoading();
        closeModal();
        showToast(`นำเข้าสำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, success > 0 ? 'success' : 'error');
        loadEvents();
        await loadAllEvents();
    };
    reader.readAsText(file);
}

// =====================================================
// Teacher Dashboard
// =====================================================

async function loadTeacherDashboard() {
    if (!currentUserData) return;
    document.getElementById('teacher-name').textContent = currentUserData.name || 'อาจารย์';
    
    try {
        const groupsSnap = await db.collection('groups').where('teacherId', '==', currentUser.uid).get();
        if (groupsSnap.empty) {
            document.getElementById('teacher-students-grid').innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">📋</div><h3>ยังไม่ได้รับมอบหมายกลุ่ม</h3></div>';
            return;
        }
        
        const group = { id: groupsSnap.docs[0].id, ...groupsSnap.docs[0].data() };
        const el = document.getElementById('teacher-group-name');
        if (el) el.textContent = group.name;
        
        await loadStudentsInGroup(group.id);
    } catch (e) { console.error(e); }
}

async function loadStudentsInGroup(groupId) {
    const container = document.getElementById('teacher-students-grid');
    if (!container) return;
    
    try {
        const snap = await db.collection('students').where('groupId', '==', groupId).get();
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">👥</div><h3>ยังไม่มีนักศึกษาในกลุ่ม</h3></div>';
            return;
        }
        
        container.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<div class="card student-card" onclick="viewStudentDetail('${doc.id}')" style="cursor:pointer;">
                <div class="card-body">
                    <div class="flex items-center gap-3">
                        <div style="width:50px;height:50px;background:var(--primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;">${(d.name || 'S').charAt(0).toUpperCase()}</div>
                        <div>
                            <h4 style="font-family:var(--font-display);">${d.name || d.email}</h4>
                            <p style="color:var(--text-muted);font-size:0.875rem;">${d.email}</p>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function viewStudentDetail(studentId) {
    viewingStudent = studentId;
    try {
        const doc = await db.collection('students').doc(studentId).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        document.getElementById('viewing-student-name').textContent = data.name || data.email;
        document.getElementById('detail-student-name').textContent = data.name || '';
        document.getElementById('detail-student-email').textContent = data.email;
        
        showPage('student-detail-page');
        await loadStudentJournals(studentId);
    } catch (e) { console.error(e); }
}

async function loadStudentJournals(studentId) {
    const container = document.getElementById('student-journals-timeline');
    if (!container) return;
    
    try {
        const snap = await db.collection('journals').where('studentId', '==', studentId).orderBy('date', 'desc').get();
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">📝</div><h3>ยังไม่มีบันทึก</h3></div>';
            return;
        }
        
        container.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<div class="card mb-2">
                <div class="card-body">
                    <div class="flex justify-between items-start mb-2">
                        <h4 style="font-family:var(--font-display);">${formatDateThai(d.date)}</h4>
                        <button class="btn btn-secondary btn-sm" onclick="showTeacherNoteModal('${studentId}','${d.date}')"><i class="fas fa-sticky-note"></i> โน้ต</button>
                    </div>
                    <p><strong>การเรียนรู้:</strong> ${d.learning || '-'}</p>
                    <p><strong>ความรู้สึก:</strong> ${d.feeling || '-'}</p>
                    <p><strong>การนำไปใช้:</strong> ${d.application || '-'}</p>
                </div>
            </div>`;
        }).join('');
        
        document.getElementById('detail-journals-count').textContent = snap.size;
    } catch (e) { console.error(e); }
}

function backToTeacherDashboard() {
    viewingStudent = null;
    showPage('teacher-page');
}

function showTeacherNoteModal(studentId, date) {
    const template = document.getElementById('teacher-note-modal-template');
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(template.content.cloneNode(true));
    document.getElementById('note-student-id').value = studentId;
    document.getElementById('note-date').value = date;
    document.getElementById('modal-overlay').classList.add('active');
    
    loadExistingTeacherNote(studentId, date);
    document.getElementById('teacher-note-form').addEventListener('submit', handleTeacherNoteSubmit);
}

async function loadExistingTeacherNote(studentId, date) {
    try {
        const snap = await db.collection('teacherNotes').where('studentId', '==', studentId).where('date', '==', date).get();
        if (!snap.empty) {
            const d = snap.docs[0].data();
            document.getElementById('note-content').value = d.content || '';
            document.getElementById('note-visible').checked = d.visibleToStudent || false;
        }
    } catch (e) { console.error(e); }
}

async function handleTeacherNoteSubmit(e) {
    e.preventDefault();
    const studentId = document.getElementById('note-student-id').value;
    const date = document.getElementById('note-date').value;
    const content = document.getElementById('note-content').value;
    const visibleToStudent = document.getElementById('note-visible').checked;
    
    try {
        const existing = await db.collection('teacherNotes').where('studentId', '==', studentId).where('date', '==', date).get();
        if (!existing.empty) {
            await db.collection('teacherNotes').doc(existing.docs[0].id).update({ content, visibleToStudent, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            await db.collection('teacherNotes').add({ studentId, date, teacherId: currentUser.uid, content, visibleToStudent, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        showToast('บันทึกโน้ตสำเร็จ', 'success');
        closeModal();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function analyzeSkillGap() {
    if (!viewingStudent) return;
    const resultDiv = document.getElementById('ai-analysis-result');
    resultDiv.innerHTML = '<div class="text-center"><div class="spinner" style="margin:0 auto;"></div><p style="margin-top:1rem;">กำลังวิเคราะห์...</p></div>';
    
    try {
        const snap = await db.collection('journals').where('studentId', '==', viewingStudent).orderBy('date', 'asc').get();
        if (snap.empty) { resultDiv.innerHTML = '<p style="color:var(--text-muted);">ยังไม่มีข้อมูล</p>'; return; }
        
        const journals = snap.docs.map(d => d.data());
        const studentDoc = await db.collection('students').doc(viewingStudent).get();
        const studentName = studentDoc.data()?.name || 'นักศึกษา';
        
        const analysis = await analyzeStudentSkillGap(journals, studentName);
        resultDiv.innerHTML = `<div style="white-space:pre-wrap;">${analysis}</div>`;
    } catch (e) { console.error(e); resultDiv.innerHTML = '<p style="color:var(--error);">เกิดข้อผิดพลาด</p>'; }
}

// =====================================================
// Student Dashboard
// =====================================================

async function loadStudentDashboard() {
    if (!currentUserData) return;
    document.getElementById('student-name').textContent = currentUserData.name || 'นักศึกษา';
    
    // Get student's event
    if (currentUserData.eventId) {
        try {
            const eventDoc = await db.collection('events').doc(currentUserData.eventId).get();
            if (eventDoc.exists) currentEvent = { id: eventDoc.id, ...eventDoc.data() };
        } catch (e) { console.error(e); }
    }
    
    renderCalendar();
    selectedDate = getDateString(new Date());
}

async function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    document.getElementById('calendar-month-year').textContent = new Date(year, month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = getDateString(new Date());
    const container = document.getElementById('calendar-days');
    container.innerHTML = '';
    
    // Get event days
    let eventDays = [];
    if (currentEvent) eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
    
    // Get completed journals
    let completedDates = [];
    try {
        const snap = await db.collection('journals').where('studentId', '==', currentUser.uid).get();
        completedDates = snap.docs.map(d => d.data().date);
    } catch (e) { console.error(e); }
    
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day empty';
        container.appendChild(cell);
    }
    
    // Days
    for (let day = 1; day <= totalDays; day++) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;
        
        const isToday = date === today;
        const isEventDay = eventDays.includes(date);
        const isCompleted = completedDates.includes(date);
        const isPast = date < today;
        const isFuture = date > today;
        
        if (isToday) cell.classList.add('today');
        
        if (isEventDay) {
            cell.classList.add('event-day');
            
            if (isCompleted) {
                cell.classList.add('completed');
            } else if (isPast || isToday) {
                cell.classList.add('pending');
            } else if (isFuture) {
                cell.classList.add('future');
            }
            
            if (!isFuture) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', () => selectCalendarDate(date));
            }
        } else {
            cell.classList.add('disabled');
        }
        
        container.appendChild(cell);
    }
}

function selectCalendarDate(date) {
    selectedDate = date;
    document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
    event.target.classList.add('selected');
    
    const tab = document.querySelector('[data-tab="student-journal"]');
    if (tab) switchTab(tab, 'student-journal');
}

function navigateCalendar(direction) {
    calendarDate.setMonth(calendarDate.getMonth() + direction);
    renderCalendar();
}

async function loadJournalForDate(date) {
    if (!date) return;
    selectedDate = date;
    document.getElementById('journal-date').textContent = formatDateThai(date);
    
    // Reset form
    document.getElementById('journal-learning').value = '';
    document.getElementById('journal-feeling').value = '';
    document.getElementById('journal-application').value = '';
    document.querySelectorAll('.star-rating').forEach(r => {
        r.dataset.rating = 0;
        r.querySelectorAll('i').forEach(s => s.classList.remove('active'));
    });
    
    try {
        const snap = await db.collection('journals').where('studentId', '==', currentUser.uid).where('date', '==', date).limit(1).get();
        if (!snap.empty) {
            const d = snap.docs[0].data();
            document.getElementById('journal-learning').value = d.learning || '';
            document.getElementById('journal-feeling').value = d.feeling || '';
            document.getElementById('journal-application').value = d.application || '';
            
            ['clo1', 'clo2', 'clo3', 'clo4'].forEach(clo => {
                const rating = document.querySelector(`[data-clo="${clo}"]`);
                if (rating && d[clo]) {
                    rating.dataset.rating = d[clo];
                    rating.querySelectorAll('i').forEach((s, i) => s.classList.toggle('active', i < d[clo]));
                }
            });
        }
    } catch (e) { console.error(e); }
    
    loadTeacherNotesForStudent(date);
}

async function loadTeacherNotesForStudent(date) {
    const section = document.getElementById('teacher-notes-section');
    const content = document.getElementById('teacher-notes-content');
    
    try {
        const snap = await db.collection('teacherNotes')
            .where('studentId', '==', currentUser.uid)
            .where('date', '==', date)
            .where('visibleToStudent', '==', true).limit(1).get();
        
        if (!snap.empty) {
            content.textContent = snap.docs[0].data().content;
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

async function handleJournalSubmit(e) {
    e.preventDefault();
    if (!selectedDate) { showToast('กรุณาเลือกวันที่', 'error'); return; }
    
    const learning = document.getElementById('journal-learning').value.trim();
    const feeling = document.getElementById('journal-feeling').value.trim();
    const application = document.getElementById('journal-application').value.trim();
    const clo1 = parseInt(document.querySelector('[data-clo="clo1"]')?.dataset.rating) || 0;
    const clo2 = parseInt(document.querySelector('[data-clo="clo2"]')?.dataset.rating) || 0;
    const clo3 = parseInt(document.querySelector('[data-clo="clo3"]')?.dataset.rating) || 0;
    const clo4 = parseInt(document.querySelector('[data-clo="clo4"]')?.dataset.rating) || 0;
    
    showLoading();
    try {
        const existing = await db.collection('journals').where('studentId', '==', currentUser.uid).where('date', '==', selectedDate).limit(1).get();
        
        const data = { studentId: currentUser.uid, date: selectedDate, learning, feeling, application, clo1, clo2, clo3, clo4, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (currentUserData.eventId) data.eventId = currentUserData.eventId;
        
        if (!existing.empty) {
            await db.collection('journals').doc(existing.docs[0].id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('journals').add(data);
        }
        
        showToast('บันทึกสำเร็จ', 'success');
        renderCalendar();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
    hideLoading();
}

async function loadJournalHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;
    
    try {
        const snap = await db.collection('journals').where('studentId', '==', currentUser.uid).orderBy('date', 'desc').get();
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">📝</div><h3>ยังไม่มีบันทึก</h3></div>';
            return;
        }
        
        container.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<div class="card mb-2">
                <div class="card-body">
                    <h4 style="font-family:var(--font-display);margin-bottom:0.5rem;">${formatDateThai(d.date)}</h4>
                    <p><strong>การเรียนรู้:</strong> ${d.learning || '-'}</p>
                    <p><strong>ความรู้สึก:</strong> ${d.feeling || '-'}</p>
                    <p style="margin-bottom:0.5rem;"><strong>การนำไปใช้:</strong> ${d.application || '-'}</p>
                    <div class="flex gap-2" style="font-size:0.875rem;color:var(--text-muted);">
                        <span>CLO1: ${d.clo1 || 0}⭐</span>
                        <span>CLO2: ${d.clo2 || 0}⭐</span>
                        <span>CLO3: ${d.clo3 || 0}⭐</span>
                        <span>CLO4: ${d.clo4 || 0}⭐</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadCommunityNotes() {
    const container = document.getElementById('community-notes-list');
    if (!container) return;
    
    try {
        const snap = await db.collection('communityNotes').where('studentId', '==', currentUser.uid).orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem;">🔍</div><h3>ยังไม่มีโน้ต</h3></div>';
            return;
        }
        
        container.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<div class="card">
                <div class="card-body">
                    <div class="flex justify-between items-start">
                        <h4 style="font-family:var(--font-display);">${d.title || 'ไม่มีหัวข้อ'}</h4>
                        <button class="btn btn-danger btn-sm" onclick="deleteCommunityNote('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                    <p style="color:var(--text-secondary);margin-top:0.5rem;">${d.content || ''}</p>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function handleCommunityNoteSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('community-note-title').value.trim();
    const content = document.getElementById('community-note-content').value.trim();
    
    if (!title || !content) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
    
    try {
        await db.collection('communityNotes').add({ studentId: currentUser.uid, title, content, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('community-note-title').value = '';
        document.getElementById('community-note-content').value = '';
        showToast('เพิ่มโน้ตสำเร็จ', 'success');
        loadCommunityNotes();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function deleteCommunityNote(noteId) {
    if (!confirm('ต้องการลบ?')) return;
    try {
        await db.collection('communityNotes').doc(noteId).delete();
        showToast('ลบสำเร็จ', 'success');
        loadCommunityNotes();
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function loadLearningJourney() {
    if (!currentEvent) {
        document.getElementById('journey-incomplete').classList.remove('hidden');
        document.getElementById('journey-complete').classList.add('hidden');
        return;
    }
    
    const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
    
    try {
        const snap = await db.collection('journals').where('studentId', '==', currentUser.uid).get();
        const journalDates = snap.docs.map(d => d.data().date);
        const completedDays = eventDays.filter(day => journalDates.includes(day)).length;
        
        document.getElementById('journey-progress-text').textContent = `${completedDays}/${eventDays.length} วัน`;
        document.getElementById('journey-progress-bar').style.width = `${(completedDays / eventDays.length) * 100}%`;
        
        if (completedDays >= eventDays.length) {
            document.getElementById('journey-incomplete').classList.add('hidden');
            document.getElementById('journey-complete').classList.remove('hidden');
            generateJourneyPreview();
        } else {
            document.getElementById('journey-incomplete').classList.remove('hidden');
            document.getElementById('journey-complete').classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

async function generateJourneyPreview() {
    const preview = document.getElementById('journey-preview');
    try {
        const snap = await db.collection('journals').where('studentId', '==', currentUser.uid).orderBy('date', 'asc').get();
        const journals = snap.docs.map(d => d.data());
        
        const avgCLO = {
            clo1: journals.reduce((s, j) => s + (j.clo1 || 0), 0) / journals.length,
            clo2: journals.reduce((s, j) => s + (j.clo2 || 0), 0) / journals.length,
            clo3: journals.reduce((s, j) => s + (j.clo3 || 0), 0) / journals.length,
            clo4: journals.reduce((s, j) => s + (j.clo4 || 0), 0) / journals.length
        };
        
        preview.innerHTML = `<div class="card">
            <div class="card-body">
                <h3 style="font-family:var(--font-display);margin-bottom:1rem;">📊 สรุป CLO</h3>
                <div class="grid grid-cols-2 gap-2">
                    <div style="text-align:center;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);"><div style="font-size:1.5rem;font-weight:600;color:var(--primary);">${avgCLO.clo1.toFixed(1)}</div><div style="font-size:0.875rem;color:var(--text-muted);">CLO1</div></div>
                    <div style="text-align:center;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);"><div style="font-size:1.5rem;font-weight:600;color:var(--primary);">${avgCLO.clo2.toFixed(1)}</div><div style="font-size:0.875rem;color:var(--text-muted);">CLO2</div></div>
                    <div style="text-align:center;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);"><div style="font-size:1.5rem;font-weight:600;color:var(--primary);">${avgCLO.clo3.toFixed(1)}</div><div style="font-size:0.875rem;color:var(--text-muted);">CLO3</div></div>
                    <div style="text-align:center;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-md);"><div style="font-size:1.5rem;font-weight:600;color:var(--primary);">${avgCLO.clo4.toFixed(1)}</div><div style="font-size:0.875rem;color:var(--text-muted);">CLO4</div></div>
                </div>
            </div>
        </div>`;
    } catch (e) { console.error(e); }
}

async function generateJourneyPDF() {
    showToast('กำลังสร้าง PDF...', 'info');
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        doc.setFontSize(24);
        doc.text('Learning Journey', 20, 20);
        doc.setFontSize(14);
        doc.text(currentUserData.name || 'Student', 20, 35);
        doc.save('learning-journey.pdf');
        showToast('ดาวน์โหลด PDF สำเร็จ', 'success');
    } catch (e) { console.error(e); showToast('เกิดข้อผิดพลาด', 'error'); }
}

function handleFileSelect(e) {
    selectedFiles = Array.from(e.target.files);
    const preview = document.getElementById('file-preview');
    preview.innerHTML = selectedFiles.map(f => `<div class="file-item"><i class="fas ${f.type.includes('image') ? 'fa-image' : f.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-audio'}"></i><span>${f.name}</span></div>`).join('');
}
