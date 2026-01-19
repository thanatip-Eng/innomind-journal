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

// Calendar State
let calendarDate = new Date();

// =====================================================
// Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            await loadCurrentEvent();
            navigateToRoleDashboard();
        } else {
            currentUser = null;
            currentUserRole = null;
            currentUserData = null;
            showPage('login-page');
        }
        hideLoading();
    });
    
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Logout buttons
    document.getElementById('admin-logout')?.addEventListener('click', handleLogout);
    document.getElementById('teacher-logout')?.addEventListener('click', handleLogout);
    document.getElementById('student-logout')?.addEventListener('click', handleLogout);
    document.getElementById('student-detail-logout')?.addEventListener('click', handleLogout);
    
    // Navigation tabs
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab) switchTab(e.currentTarget, tab);
        });
    });
    
    // Journal form
    document.getElementById('journal-form')?.addEventListener('submit', handleJournalSubmit);
    
    // Community note form
    document.getElementById('community-note-form')?.addEventListener('submit', handleCommunityNoteSubmit);
    
    // File upload
    document.getElementById('journal-files')?.addEventListener('change', handleFileSelect);
    
    // Calendar navigation
    document.getElementById('prev-month')?.addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('next-month')?.addEventListener('click', () => navigateCalendar(1));
    
    // Star ratings
    setupStarRatings();
    
    // Modal close on overlay click
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function setupStarRatings() {
    document.querySelectorAll('.star-rating').forEach(rating => {
        const stars = rating.querySelectorAll('i');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const value = parseInt(star.dataset.value);
                const clo = rating.dataset.clo;
                
                stars.forEach((s, i) => {
                    if (i < value) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
                
                rating.dataset.value = value;
            });
            
            star.addEventListener('mouseenter', () => {
                const value = parseInt(star.dataset.value);
                stars.forEach((s, i) => {
                    if (i < value) {
                        s.style.color = 'var(--secondary)';
                    }
                });
            });
            
            star.addEventListener('mouseleave', () => {
                const currentValue = parseInt(rating.dataset.value) || 0;
                stars.forEach((s, i) => {
                    if (i < currentValue) {
                        s.style.color = 'var(--secondary)';
                    } else {
                        s.style.color = 'var(--gray-300)';
                    }
                });
            });
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
        errorDiv.textContent = getAuthErrorMessage(error.code);
        hideLoading();
    }
}

function handleLogout() {
    auth.signOut();
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
        'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
        'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
        'auth/too-many-requests': 'มีการลองเข้าสู่ระบบมากเกินไป กรุณารอสักครู่'
    };
    return messages[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

// =====================================================
// User Data Management
// =====================================================

async function loadUserData() {
    try {
        // Check if super admin
        const adminDoc = await db.collection('admins').doc(currentUser.uid).get();
        if (adminDoc.exists) {
            currentUserRole = 'admin';
            currentUserData = adminDoc.data();
            return;
        }
        
        // Check if teacher
        const teacherDoc = await db.collection('teachers').doc(currentUser.uid).get();
        if (teacherDoc.exists) {
            currentUserRole = 'teacher';
            currentUserData = teacherDoc.data();
            return;
        }
        
        // Check if student
        const studentDoc = await db.collection('students').doc(currentUser.uid).get();
        if (studentDoc.exists) {
            currentUserRole = 'student';
            currentUserData = studentDoc.data();
            return;
        }
        
        // No role found - logout
        showToast('ไม่พบข้อมูลผู้ใช้ในระบบ', 'error');
        await auth.signOut();
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    }
}

async function loadCurrentEvent() {
    try {
        const today = new Date();
        const eventsSnapshot = await db.collection('events')
            .where('startDate', '<=', getDateString(today))
            .where('endDate', '>=', getDateString(today))
            .limit(1)
            .get();
        
        if (!eventsSnapshot.empty) {
            currentEvent = {
                id: eventsSnapshot.docs[0].id,
                ...eventsSnapshot.docs[0].data()
            };
        } else {
            // Get latest event
            const latestSnapshot = await db.collection('events')
                .orderBy('startDate', 'desc')
                .limit(1)
                .get();
            
            if (!latestSnapshot.empty) {
                currentEvent = {
                    id: latestSnapshot.docs[0].id,
                    ...latestSnapshot.docs[0].data()
                };
            }
        }
    } catch (error) {
        console.error('Error loading event:', error);
    }
}

// =====================================================
// Navigation
// =====================================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId)?.classList.remove('hidden');
}

function navigateToRoleDashboard() {
    switch (currentUserRole) {
        case 'admin':
            showPage('admin-page');
            document.getElementById('admin-name').textContent = currentUserData?.name || 'Admin';
            loadAdminDashboard();
            break;
        case 'teacher':
            showPage('teacher-page');
            document.getElementById('teacher-name').textContent = currentUserData?.name || 'อาจารย์';
            loadTeacherDashboard();
            break;
        case 'student':
            showPage('student-page');
            document.getElementById('student-name').textContent = currentUserData?.name || 'นักศึกษา';
            loadStudentDashboard();
            break;
        default:
            showPage('login-page');
    }
}

function switchTab(button, tabId) {
    // Update nav buttons
    button.parentElement.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update tab content
    const page = button.closest('.page');
    page.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(tabId)?.classList.remove('hidden');
    
    // Load tab-specific data
    if (tabId === 'student-journal') {
        loadJournalForDate(selectedDate || getDateString(new Date()));
    } else if (tabId === 'student-history') {
        loadJournalHistory();
    } else if (tabId === 'student-community') {
        loadCommunityNotes();
    } else if (tabId === 'student-journey') {
        loadLearningJourney();
    }
}

// =====================================================
// Admin Dashboard
// =====================================================

async function loadAdminDashboard() {
    await Promise.all([
        loadStudentsTable(),
        loadTeachersTable(),
        loadGroups(),
        loadEvents(),
        loadStatistics()
    ]);
}

async function loadStudentsTable() {
    const tbody = document.getElementById('students-table');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('students').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">ยังไม่มีนักศึกษาในระบบ</td></tr>';
            return;
        }
        
        const groups = {};
        const groupsSnapshot = await db.collection('groups').get();
        groupsSnapshot.forEach(doc => {
            groups[doc.id] = doc.data().name;
        });
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.email}</td>
                    <td>${data.name}</td>
                    <td>${groups[data.groupId] || '-'}</td>
                    <td><span class="badge ${data.active !== false ? 'badge-student' : 'badge-info'}">${data.active !== false ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-outline" onclick="editUser('student', '${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('student', '${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading students:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">เกิดข้อผิดพลาด</td></tr>';
    }
}

async function loadTeachersTable() {
    const tbody = document.getElementById('teachers-table');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('teachers').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ยังไม่มีอาจารย์ในระบบ</td></tr>';
            return;
        }
        
        const groups = {};
        const groupsSnapshot = await db.collection('groups').get();
        groupsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.teacherId) {
                if (!groups[data.teacherId]) groups[data.teacherId] = [];
                groups[data.teacherId].push(data.name);
            }
        });
        
        tbody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const teacherGroups = groups[doc.id] || [];
            return `
                <tr>
                    <td>${data.email}</td>
                    <td>${data.name}</td>
                    <td>${teacherGroups.join(', ') || '-'}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-outline" onclick="editUser('teacher', '${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('teacher', '${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

async function loadGroups() {
    const container = document.getElementById('groups-container');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('groups').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><h3>ยังไม่มีกลุ่ม</h3><p>คลิก "สร้างกลุ่ม" เพื่อเริ่มต้น</p></div>';
            return;
        }
        
        // Get teachers
        const teachers = {};
        const teachersSnapshot = await db.collection('teachers').get();
        teachersSnapshot.forEach(doc => {
            teachers[doc.id] = doc.data().name;
        });
        
        // Get student counts
        const studentCounts = {};
        const studentsSnapshot = await db.collection('students').get();
        studentsSnapshot.forEach(doc => {
            const groupId = doc.data().groupId;
            if (groupId) {
                studentCounts[groupId] = (studentCounts[groupId] || 0) + 1;
            }
        });
        
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="group-card">
                    <div class="group-card-header">
                        <div>
                            <h3>${data.name}</h3>
                            <div class="group-teacher">
                                <i class="fas fa-chalkboard-teacher"></i>
                                ${teachers[data.teacherId] || 'ยังไม่กำหนด'}
                            </div>
                        </div>
                        <button class="btn btn-sm btn-ghost" onclick="deleteGroup('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="group-stats">
                        <div class="group-stat">
                            <span class="value">${studentCounts[doc.id] || 0}</span>
                            <span class="label">นักศึกษา</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('events').orderBy('startDate', 'desc').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><h3>ยังไม่มีอีเวนท์</h3><p>คลิก "สร้างอีเวนท์" เพื่อเริ่มต้น</p></div>';
            return;
        }
        
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const startDate = new Date(data.startDate);
            const endDate = new Date(data.endDate);
            const days = getDaysBetween(data.startDate, data.endDate).length;
            
            return `
                <div class="event-card">
                    <div class="event-date-box">
                        <div class="month">${startDate.toLocaleDateString('th-TH', { month: 'short' })}</div>
                        <div class="day">${startDate.getDate()}</div>
                    </div>
                    <div class="event-info">
                        <h3>${data.name}</h3>
                        <p>${data.description || ''}</p>
                        <div class="event-duration">
                            <i class="fas fa-clock"></i>
                            ${formatDateShort(data.startDate)} - ${formatDateShort(data.endDate)} (${days} วัน)
                        </div>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="deleteEvent('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

async function loadStatistics() {
    try {
        const studentsSnapshot = await db.collection('students').get();
        const totalStudents = studentsSnapshot.size;
        
        document.getElementById('stat-total-students').textContent = totalStudents;
        
        if (!currentEvent) {
            document.getElementById('stat-completed-today').textContent = '-';
            document.getElementById('stat-pending-today').textContent = '-';
            document.getElementById('stat-completion-rate').textContent = '-';
            return;
        }
        
        const today = getDateString(new Date());
        const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
        
        // Count journals for today
        const journalsSnapshot = await db.collection('journals')
            .where('date', '==', today)
            .get();
        
        const completedToday = journalsSnapshot.size;
        const pendingToday = totalStudents - completedToday;
        const rate = totalStudents > 0 ? Math.round((completedToday / totalStudents) * 100) : 0;
        
        document.getElementById('stat-completed-today').textContent = completedToday;
        document.getElementById('stat-pending-today').textContent = pendingToday;
        document.getElementById('stat-completion-rate').textContent = rate + '%';
        
        // Load daily stats
        await loadDailyStats(eventDays, totalStudents);
        
        // Load group stats
        await loadGroupStats();
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadDailyStats(eventDays, totalStudents) {
    const tbody = document.getElementById('daily-stats-table');
    if (!tbody) return;
    
    const rows = [];
    
    for (const day of eventDays) {
        const journalsSnapshot = await db.collection('journals')
            .where('date', '==', day)
            .get();
        
        const completed = journalsSnapshot.size;
        const pending = totalStudents - completed;
        const rate = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;
        
        rows.push(`
            <tr>
                <td>${formatDateShort(day)}</td>
                <td>${completed}</td>
                <td>${pending}</td>
                <td>${rate}%</td>
            </tr>
        `);
    }
    
    tbody.innerHTML = rows.join('');
}

async function loadGroupStats() {
    const container = document.getElementById('group-stats-container');
    if (!container) return;
    
    try {
        const groupsSnapshot = await db.collection('groups').get();
        
        if (groupsSnapshot.empty) {
            container.innerHTML = '<p class="empty-state">ยังไม่มีกลุ่ม</p>';
            return;
        }
        
        const stats = [];
        
        for (const groupDoc of groupsSnapshot.docs) {
            const groupData = groupDoc.data();
            
            const studentsSnapshot = await db.collection('students')
                .where('groupId', '==', groupDoc.id)
                .get();
            
            const totalStudents = studentsSnapshot.size;
            
            if (currentEvent && totalStudents > 0) {
                const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
                const totalExpected = totalStudents * eventDays.length;
                
                let totalJournals = 0;
                for (const studentDoc of studentsSnapshot.docs) {
                    const journalsSnapshot = await db.collection('journals')
                        .where('studentId', '==', studentDoc.id)
                        .get();
                    totalJournals += journalsSnapshot.size;
                }
                
                const rate = totalExpected > 0 ? Math.round((totalJournals / totalExpected) * 100) : 0;
                
                stats.push({
                    name: groupData.name,
                    students: totalStudents,
                    rate: rate
                });
            } else {
                stats.push({
                    name: groupData.name,
                    students: totalStudents,
                    rate: 0
                });
            }
        }
        
        container.innerHTML = `
            <div class="stats-grid">
                ${stats.map(s => `
                    <div class="stat-card">
                        <div class="stat-icon purple">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <h3>${s.name}</h3>
                            <p>${s.students} คน | ${s.rate}% ครบถ้วน</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading group stats:', error);
    }
}

// =====================================================
// Admin Modal Functions
// =====================================================

function showAddUserModal() {
    const template = document.getElementById('add-user-modal-template');
    const modal = template.content.cloneNode(true);
    
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(modal);
    document.getElementById('modal-overlay').classList.remove('hidden');
    
    // Load groups for dropdown
    loadGroupsDropdown('user-group');
    
    // Handle user type change
    document.getElementById('user-type').addEventListener('change', (e) => {
        const groupField = document.getElementById('student-group-field');
        groupField.style.display = e.target.value === 'student' ? 'block' : 'none';
    });
    
    // Handle form submit
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
}

async function loadGroupsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    try {
        const snapshot = await db.collection('groups').get();
        
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading groups dropdown:', error);
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const type = document.getElementById('user-type').value;
    const email = document.getElementById('user-email').value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;
    const groupId = document.getElementById('user-group')?.value;
    
    showLoading();
    
    try {
        // Create user in Firebase Auth using admin SDK simulation
        // Note: In production, use Cloud Functions for this
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        // Add to appropriate collection
        const collection = type === 'teacher' ? 'teachers' : 'students';
        const userData = {
            email,
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (type === 'student' && groupId) {
            userData.groupId = groupId;
        }
        
        await db.collection(collection).doc(userId).set(userData);
        
        // Sign back in as admin
        // Note: This is a workaround. In production, use Cloud Functions
        
        closeModal();
        showToast('เพิ่มผู้ใช้สำเร็จ', 'success');
        
        if (type === 'teacher') {
            loadTeachersTable();
        } else {
            loadStudentsTable();
        }
        
    } catch (error) {
        console.error('Error adding user:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
    
    hideLoading();
}

function showAddGroupModal() {
    const template = document.getElementById('add-group-modal-template');
    const modal = template.content.cloneNode(true);
    
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(modal);
    document.getElementById('modal-overlay').classList.remove('hidden');
    
    // Load teachers for dropdown
    loadTeachersDropdown('group-teacher');
    
    // Handle form submit
    document.getElementById('add-group-form').addEventListener('submit', handleAddGroup);
}

async function loadTeachersDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    try {
        const snapshot = await db.collection('teachers').get();
        
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading teachers dropdown:', error);
    }
}

async function handleAddGroup(e) {
    e.preventDefault();
    
    const name = document.getElementById('group-name').value;
    const teacherId = document.getElementById('group-teacher').value;
    
    showLoading();
    
    try {
        await db.collection('groups').add({
            name,
            teacherId: teacherId || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal();
        showToast('สร้างกลุ่มสำเร็จ', 'success');
        loadGroups();
        
    } catch (error) {
        console.error('Error adding group:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

function showAddEventModal() {
    const template = document.getElementById('add-event-modal-template');
    const modal = template.content.cloneNode(true);
    
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(modal);
    document.getElementById('modal-overlay').classList.remove('hidden');
    
    // Handle form submit
    document.getElementById('add-event-form').addEventListener('submit', handleAddEvent);
}

async function handleAddEvent(e) {
    e.preventDefault();
    
    const name = document.getElementById('event-name').value;
    const startDate = document.getElementById('event-start').value;
    const endDate = document.getElementById('event-end').value;
    const description = document.getElementById('event-description').value;
    
    if (new Date(startDate) > new Date(endDate)) {
        showToast('วันเริ่มต้นต้องก่อนวันสิ้นสุด', 'error');
        return;
    }
    
    showLoading();
    
    try {
        await db.collection('events').add({
            name,
            startDate,
            endDate,
            description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal();
        showToast('สร้างอีเวนท์สำเร็จ', 'success');
        loadEvents();
        await loadCurrentEvent();
        
    } catch (error) {
        console.error('Error adding event:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

async function deleteGroup(groupId) {
    if (!confirm('ต้องการลบกลุ่มนี้หรือไม่?')) return;
    
    try {
        await db.collection('groups').doc(groupId).delete();
        showToast('ลบกลุ่มสำเร็จ', 'success');
        loadGroups();
    } catch (error) {
        console.error('Error deleting group:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
}

async function deleteEvent(eventId) {
    if (!confirm('ต้องการลบอีเวนท์นี้หรือไม่?')) return;
    
    try {
        await db.collection('events').doc(eventId).delete();
        showToast('ลบอีเวนท์สำเร็จ', 'success');
        loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
}

async function deleteUser(type, userId) {
    if (!confirm('ต้องการลบผู้ใช้นี้หรือไม่?')) return;
    
    try {
        const collection = type === 'teacher' ? 'teachers' : 'students';
        await db.collection(collection).doc(userId).delete();
        
        showToast('ลบผู้ใช้สำเร็จ', 'success');
        
        if (type === 'teacher') {
            loadTeachersTable();
        } else {
            loadStudentsTable();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';
}

// =====================================================
// Teacher Dashboard
// =====================================================

async function loadTeacherDashboard() {
    if (!currentUserData) return;
    
    // Find teacher's group
    try {
        const groupsSnapshot = await db.collection('groups')
            .where('teacherId', '==', currentUser.uid)
            .get();
        
        if (groupsSnapshot.empty) {
            document.getElementById('teacher-students-grid').innerHTML = 
                '<div class="empty-state"><i class="fas fa-users"></i><h3>ยังไม่ได้รับมอบหมายกลุ่ม</h3></div>';
            return;
        }
        
        const group = {
            id: groupsSnapshot.docs[0].id,
            ...groupsSnapshot.docs[0].data()
        };
        
        document.getElementById('teacher-group-name').textContent = group.name;
        
        await loadTeacherStudents(group.id);
        
    } catch (error) {
        console.error('Error loading teacher dashboard:', error);
    }
}

async function loadTeacherStudents(groupId) {
    const grid = document.getElementById('teacher-students-grid');
    if (!grid) return;
    
    try {
        const snapshot = await db.collection('students')
            .where('groupId', '==', groupId)
            .get();
        
        if (snapshot.empty) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>ยังไม่มีนักศึกษาในกลุ่ม</h3></div>';
            return;
        }
        
        const students = [];
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Get journal count
            let journalCount = 0;
            let totalDays = 0;
            
            if (currentEvent) {
                const journalsSnapshot = await db.collection('journals')
                    .where('studentId', '==', doc.id)
                    .get();
                journalCount = journalsSnapshot.size;
                totalDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate).length;
            }
            
            const progress = totalDays > 0 ? Math.round((journalCount / totalDays) * 100) : 0;
            
            students.push({
                id: doc.id,
                ...data,
                journalCount,
                totalDays,
                progress
            });
        }
        
        grid.innerHTML = students.map(s => `
            <div class="student-card" onclick="viewStudentDetail('${s.id}')">
                <div class="student-card-header">
                    <div class="student-avatar">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <div>
                        <h3>${s.name}</h3>
                        <p>${s.email}</p>
                    </div>
                </div>
                <div class="student-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${s.progress}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${s.journalCount}/${s.totalDays} วัน</span>
                        <span>${s.progress}%</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Update overview stats
        document.getElementById('teacher-stat-students').textContent = students.length;
        const completed = students.filter(s => s.progress === 100).length;
        document.getElementById('teacher-stat-completed').textContent = completed;
        
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function viewStudentDetail(studentId) {
    showLoading();
    
    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (!studentDoc.exists) {
            showToast('ไม่พบข้อมูลนักศึกษา', 'error');
            hideLoading();
            return;
        }
        
        viewingStudent = {
            id: studentId,
            ...studentDoc.data()
        };
        
        showPage('student-detail-page');
        
        document.getElementById('viewing-student-name').textContent = viewingStudent.name;
        document.getElementById('detail-student-name').textContent = viewingStudent.name;
        document.getElementById('detail-student-email').textContent = viewingStudent.email;
        
        await loadStudentJournalsTimeline(studentId);
        
    } catch (error) {
        console.error('Error viewing student:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

async function loadStudentJournalsTimeline(studentId) {
    const timeline = document.getElementById('student-journals-timeline');
    if (!timeline || !currentEvent) return;
    
    try {
        const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
        
        // Get all journals for this student
        const journalsSnapshot = await db.collection('journals')
            .where('studentId', '==', studentId)
            .get();
        
        const journals = {};
        journalsSnapshot.forEach(doc => {
            journals[doc.data().date] = {
                id: doc.id,
                ...doc.data()
            };
        });
        
        // Get teacher notes
        const notesSnapshot = await db.collection('teacherNotes')
            .where('studentId', '==', studentId)
            .get();
        
        const notes = {};
        notesSnapshot.forEach(doc => {
            notes[doc.data().date] = {
                id: doc.id,
                ...doc.data()
            };
        });
        
        // Update stats
        const journalCount = Object.keys(journals).length;
        const completion = eventDays.length > 0 ? Math.round((journalCount / eventDays.length) * 100) : 0;
        document.getElementById('detail-journals-count').textContent = journalCount;
        document.getElementById('detail-completion').textContent = completion + '%';
        
        // Build timeline
        timeline.innerHTML = eventDays.map(day => {
            const journal = journals[day];
            const note = notes[day];
            const isCompleted = !!journal;
            
            return `
                <div class="journal-day-card">
                    <div class="journal-day-header">
                        <h4><i class="fas fa-calendar-day"></i> ${formatDateThai(day)}</h4>
                        <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
                            ${isCompleted ? 'บันทึกแล้ว' : 'ยังไม่บันทึก'}
                        </span>
                    </div>
                    <div class="journal-day-content">
                        ${isCompleted ? `
                            <div class="journal-section-view">
                                <h5><i class="fas fa-lightbulb"></i> สิ่งที่ได้เรียนรู้</h5>
                                <p>${journal.learning || '-'}</p>
                            </div>
                            <div class="journal-section-view">
                                <h5><i class="fas fa-heart"></i> ความรู้สึก</h5>
                                <p>${journal.feeling || '-'}</p>
                            </div>
                            <div class="journal-section-view">
                                <h5><i class="fas fa-rocket"></i> การนำไปใช้</h5>
                                <p>${journal.application || '-'}</p>
                            </div>
                            <div class="journal-section-view">
                                <h5><i class="fas fa-star"></i> CLO Assessment</h5>
                                <div class="clo-scores">
                                    <div class="clo-score-item">
                                        <span class="clo-label">CLO1</span>
                                        <span class="stars">${'★'.repeat(journal.clo1 || 0)}${'☆'.repeat(5 - (journal.clo1 || 0))}</span>
                                    </div>
                                    <div class="clo-score-item">
                                        <span class="clo-label">CLO2</span>
                                        <span class="stars">${'★'.repeat(journal.clo2 || 0)}${'☆'.repeat(5 - (journal.clo2 || 0))}</span>
                                    </div>
                                    <div class="clo-score-item">
                                        <span class="clo-label">CLO3</span>
                                        <span class="stars">${'★'.repeat(journal.clo3 || 0)}${'☆'.repeat(5 - (journal.clo3 || 0))}</span>
                                    </div>
                                    <div class="clo-score-item">
                                        <span class="clo-label">CLO4</span>
                                        <span class="stars">${'★'.repeat(journal.clo4 || 0)}${'☆'.repeat(5 - (journal.clo4 || 0))}</span>
                                    </div>
                                </div>
                            </div>
                            ${journal.files && journal.files.length > 0 ? `
                                <div class="journal-section-view">
                                    <h5><i class="fas fa-paperclip"></i> ไฟล์แนบ</h5>
                                    <div class="note-files">
                                        ${journal.files.map(f => `
                                            <a href="${f.url}" target="_blank" class="file-tag">
                                                <i class="fas fa-file"></i> ${f.name}
                                            </a>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        ` : '<p class="placeholder-text">ยังไม่มีการบันทึก</p>'}
                        
                        ${note ? `
                            <div class="teacher-note-box">
                                <h5><i class="fas fa-sticky-note"></i> โน้ตจากอาจารย์ ${note.visible ? '(นศ.เห็น)' : '(ซ่อน)'}</h5>
                                <p>${note.content}</p>
                            </div>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-outline add-note-btn" onclick="showTeacherNoteModal('${studentId}', '${day}')">
                            <i class="fas fa-sticky-note"></i> ${note ? 'แก้ไขโน้ต' : 'เพิ่มโน้ต'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading journals timeline:', error);
    }
}

function showTeacherNoteModal(studentId, date) {
    const template = document.getElementById('teacher-note-modal-template');
    const modal = template.content.cloneNode(true);
    
    document.getElementById('modal-container').innerHTML = '';
    document.getElementById('modal-container').appendChild(modal);
    document.getElementById('modal-overlay').classList.remove('hidden');
    
    document.getElementById('note-student-id').value = studentId;
    document.getElementById('note-date').value = date;
    
    // Load existing note if any
    loadExistingNote(studentId, date);
    
    document.getElementById('teacher-note-form').addEventListener('submit', handleTeacherNote);
}

async function loadExistingNote(studentId, date) {
    try {
        const snapshot = await db.collection('teacherNotes')
            .where('studentId', '==', studentId)
            .where('date', '==', date)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const note = snapshot.docs[0].data();
            document.getElementById('note-content').value = note.content || '';
            document.getElementById('note-visible').checked = note.visible || false;
        }
    } catch (error) {
        console.error('Error loading existing note:', error);
    }
}

async function handleTeacherNote(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('note-student-id').value;
    const date = document.getElementById('note-date').value;
    const content = document.getElementById('note-content').value;
    const visible = document.getElementById('note-visible').checked;
    
    showLoading();
    
    try {
        // Check if note exists
        const snapshot = await db.collection('teacherNotes')
            .where('studentId', '==', studentId)
            .where('date', '==', date)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                content,
                visible,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await db.collection('teacherNotes').add({
                studentId,
                date,
                teacherId: currentUser.uid,
                content,
                visible,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        closeModal();
        showToast('บันทึกโน้ตสำเร็จ', 'success');
        await loadStudentJournalsTimeline(studentId);
        
    } catch (error) {
        console.error('Error saving note:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

async function analyzeSkillGap() {
    if (!viewingStudent) return;
    
    const resultDiv = document.getElementById('ai-analysis-result');
    resultDiv.innerHTML = '<p class="placeholder-text"><i class="fas fa-spinner fa-spin"></i> กำลังวิเคราะห์...</p>';
    
    try {
        const journalsSnapshot = await db.collection('journals')
            .where('studentId', '==', viewingStudent.id)
            .get();
        
        if (journalsSnapshot.empty) {
            resultDiv.innerHTML = '<p class="placeholder-text">ยังไม่มีข้อมูลบันทึกเพียงพอสำหรับการวิเคราะห์</p>';
            return;
        }
        
        const journals = journalsSnapshot.docs.map(doc => doc.data());
        const analysis = await analyzeStudentSkillGap(journals, viewingStudent.name);
        
        // Format the analysis
        resultDiv.innerHTML = `<div class="ai-analysis-content">${analysis.replace(/\n/g, '<br>')}</div>`;
        
    } catch (error) {
        console.error('Error analyzing skill gap:', error);
        resultDiv.innerHTML = '<p class="placeholder-text">เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่</p>';
    }
}

function backToTeacherDashboard() {
    viewingStudent = null;
    showPage('teacher-page');
}

// =====================================================
// Student Dashboard
// =====================================================

async function loadStudentDashboard() {
    renderCalendar();
    
    if (currentEvent) {
        document.getElementById('current-event-info').innerHTML = `
            <span class="badge badge-info">${currentEvent.name}</span>
            <span>${formatDateShort(currentEvent.startDate)} - ${formatDateShort(currentEvent.endDate)}</span>
        `;
    }
}

function renderCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const daysContainer = document.getElementById('calendar-days');
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    monthYear.textContent = new Date(year, month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const today = getDateString(new Date());
    const eventDays = currentEvent ? getDaysBetween(currentEvent.startDate, currentEvent.endDate) : [];
    
    // Get completed days
    loadCompletedDays().then(completedDays => {
        let html = '';
        
        // Previous month days
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day other-month">${prevMonthDays - i}</div>`;
        }
        
        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isEventDay = eventDays.includes(dateStr);
            const isCompleted = completedDays.includes(dateStr);
            const isPending = isEventDay && !isCompleted && dateStr <= today;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (isEventDay) classes += ' event-day';
            if (isCompleted) classes += ' completed';
            if (isPending) classes += ' pending';
            if (selectedDate === dateStr) classes += ' selected';
            
            html += `
                <div class="${classes}" onclick="selectDate('${dateStr}')">
                    ${i}
                    ${isEventDay ? `<span class="dot ${isCompleted ? 'completed' : 'pending'}"></span>` : ''}
                </div>
            `;
        }
        
        // Next month days
        const remaining = 42 - (startDay + totalDays);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month">${i}</div>`;
        }
        
        daysContainer.innerHTML = html;
    });
}

async function loadCompletedDays() {
    try {
        const snapshot = await db.collection('journals')
            .where('studentId', '==', currentUser.uid)
            .get();
        
        return snapshot.docs.map(doc => doc.data().date);
    } catch (error) {
        console.error('Error loading completed days:', error);
        return [];
    }
}

function navigateCalendar(direction) {
    calendarDate.setMonth(calendarDate.getMonth() + direction);
    renderCalendar();
}

function selectDate(dateStr) {
    const eventDays = currentEvent ? getDaysBetween(currentEvent.startDate, currentEvent.endDate) : [];
    
    if (!eventDays.includes(dateStr)) {
        showToast('วันนี้ไม่อยู่ในช่วงอีเวนท์', 'info');
        return;
    }
    
    selectedDate = dateStr;
    renderCalendar();
    
    // Switch to journal tab
    const journalTab = document.querySelector('[data-tab="student-journal"]');
    if (journalTab) {
        switchTab(journalTab, 'student-journal');
    }
}

async function loadJournalForDate(dateStr) {
    document.getElementById('journal-date').textContent = formatDateThai(dateStr);
    
    // Reset form
    document.getElementById('journal-form').reset();
    document.querySelectorAll('.star-rating').forEach(r => {
        r.dataset.value = '0';
        r.querySelectorAll('i').forEach(s => s.classList.remove('active'));
    });
    document.getElementById('file-preview').innerHTML = '';
    selectedFiles = [];
    
    try {
        const snapshot = await db.collection('journals')
            .where('studentId', '==', currentUser.uid)
            .where('date', '==', dateStr)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const journal = snapshot.docs[0].data();
            
            document.getElementById('journal-learning').value = journal.learning || '';
            document.getElementById('journal-feeling').value = journal.feeling || '';
            document.getElementById('journal-application').value = journal.application || '';
            
            // Set star ratings
            ['clo1', 'clo2', 'clo3', 'clo4'].forEach(clo => {
                const value = journal[clo] || 0;
                const rating = document.querySelector(`.star-rating[data-clo="${clo}"]`);
                if (rating) {
                    rating.dataset.value = value;
                    rating.querySelectorAll('i').forEach((s, i) => {
                        if (i < value) s.classList.add('active');
                    });
                }
            });
            
            // Show existing files
            if (journal.files && journal.files.length > 0) {
                document.getElementById('file-preview').innerHTML = journal.files.map(f => `
                    <div class="file-preview-item">
                        <i class="fas fa-file"></i>
                        <span>${f.name}</span>
                        <a href="${f.url}" target="_blank"><i class="fas fa-external-link-alt"></i></a>
                    </div>
                `).join('');
            }
        }
        
        // Load teacher notes
        await loadTeacherNotesForStudent(dateStr);
        
    } catch (error) {
        console.error('Error loading journal:', error);
    }
}

async function loadTeacherNotesForStudent(dateStr) {
    const section = document.getElementById('teacher-notes-section');
    const content = document.getElementById('teacher-notes-content');
    
    try {
        const snapshot = await db.collection('teacherNotes')
            .where('studentId', '==', currentUser.uid)
            .where('date', '==', dateStr)
            .where('visible', '==', true)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const note = snapshot.docs[0].data();
            content.innerHTML = `<p>${note.content}</p>`;
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading teacher notes:', error);
        section.classList.add('hidden');
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    selectedFiles = [...selectedFiles, ...files];
    
    const preview = document.getElementById('file-preview');
    preview.innerHTML = selectedFiles.map((f, i) => `
        <div class="file-preview-item">
            <i class="fas fa-${getFileIcon(f.type)}"></i>
            <span>${f.name}</span>
            <button type="button" onclick="removeFile(${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function getFileIcon(type) {
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'file-pdf';
    if (type.startsWith('audio/')) return 'file-audio';
    return 'file';
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    const preview = document.getElementById('file-preview');
    preview.innerHTML = selectedFiles.map((f, i) => `
        <div class="file-preview-item">
            <i class="fas fa-${getFileIcon(f.type)}"></i>
            <span>${f.name}</span>
            <button type="button" onclick="removeFile(${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

async function handleJournalSubmit(e) {
    e.preventDefault();
    
    const dateStr = selectedDate || getDateString(new Date());
    
    // Check if within event period
    if (currentEvent) {
        const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
        if (!eventDays.includes(dateStr)) {
            showToast('ไม่สามารถบันทึกวันที่นอกช่วงอีเวนท์ได้', 'error');
            return;
        }
    }
    
    showLoading();
    
    try {
        // Upload files
        const uploadedFiles = [];
        for (const file of selectedFiles) {
            const ref = storage.ref(`journals/${currentUser.uid}/${dateStr}/${file.name}`);
            await ref.put(file);
            const url = await ref.getDownloadURL();
            uploadedFiles.push({ name: file.name, url, type: file.type });
        }
        
        // Get CLO values
        const cloValues = {};
        ['clo1', 'clo2', 'clo3', 'clo4'].forEach(clo => {
            const rating = document.querySelector(`.star-rating[data-clo="${clo}"]`);
            cloValues[clo] = parseInt(rating?.dataset.value) || 0;
        });
        
        const journalData = {
            studentId: currentUser.uid,
            date: dateStr,
            learning: document.getElementById('journal-learning').value,
            feeling: document.getElementById('journal-feeling').value,
            application: document.getElementById('journal-application').value,
            ...cloValues,
            files: uploadedFiles,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Check if exists
        const existing = await db.collection('journals')
            .where('studentId', '==', currentUser.uid)
            .where('date', '==', dateStr)
            .limit(1)
            .get();
        
        if (!existing.empty) {
            await existing.docs[0].ref.update(journalData);
        } else {
            journalData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('journals').add(journalData);
        }
        
        showToast('บันทึกสำเร็จ', 'success');
        renderCalendar();
        
    } catch (error) {
        console.error('Error saving journal:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

async function loadJournalHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('journals')
            .where('studentId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><h3>ยังไม่มีบันทึก</h3></div>';
            return;
        }
        
        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="history-card" onclick="selectDate('${data.date}')">
                    <div class="history-card-header">
                        <h3>${formatDateThai(data.date)}</h3>
                    </div>
                    <div class="history-card-body">
                        <p>${data.learning || 'ไม่มีการบันทึก'}</p>
                    </div>
                    <div class="history-card-footer">
                        <div class="clo-scores">
                            <span>CLO1: ${'★'.repeat(data.clo1 || 0)}</span>
                            <span>CLO2: ${'★'.repeat(data.clo2 || 0)}</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

async function loadCommunityNotes() {
    const list = document.getElementById('community-notes-list');
    if (!list) return;
    
    try {
        const snapshot = await db.collection('communityNotes')
            .where('studentId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-sticky-note"></i><h3>ยังไม่มีโน้ต</h3></div>';
            return;
        }
        
        list.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="community-note-card">
                    <h4>${data.title}</h4>
                    <p>${data.content}</p>
                    ${data.files && data.files.length > 0 ? `
                        <div class="note-files">
                            ${data.files.map(f => `
                                <a href="${f.url}" target="_blank" class="file-tag">
                                    <i class="fas fa-file"></i> ${f.name}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="note-meta">
                        <span>${data.createdAt ? formatDateShort(data.createdAt.toDate()) : ''}</span>
                        <button class="btn btn-sm btn-ghost" onclick="deleteCommunityNote('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading community notes:', error);
    }
}

async function handleCommunityNoteSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('community-note-title').value;
    const content = document.getElementById('community-note-content').value;
    const filesInput = document.getElementById('community-note-files');
    
    if (!title && !content) {
        showToast('กรุณากรอกหัวข้อหรือรายละเอียด', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Upload files
        const uploadedFiles = [];
        const files = filesInput.files;
        for (const file of files) {
            const ref = storage.ref(`communityNotes/${currentUser.uid}/${Date.now()}_${file.name}`);
            await ref.put(file);
            const url = await ref.getDownloadURL();
            uploadedFiles.push({ name: file.name, url, type: file.type });
        }
        
        await db.collection('communityNotes').add({
            studentId: currentUser.uid,
            title,
            content,
            files: uploadedFiles,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        document.getElementById('community-note-form').reset();
        showToast('เพิ่มโน้ตสำเร็จ', 'success');
        loadCommunityNotes();
        
    } catch (error) {
        console.error('Error saving community note:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
    
    hideLoading();
}

async function deleteCommunityNote(noteId) {
    if (!confirm('ต้องการลบโน้ตนี้หรือไม่?')) return;
    
    try {
        await db.collection('communityNotes').doc(noteId).delete();
        showToast('ลบโน้ตสำเร็จ', 'success');
        loadCommunityNotes();
    } catch (error) {
        console.error('Error deleting note:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
}

async function loadLearningJourney() {
    const incompleteDiv = document.getElementById('journey-incomplete');
    const completeDiv = document.getElementById('journey-complete');
    
    if (!currentEvent) {
        incompleteDiv.innerHTML = '<div class="journey-progress-card"><i class="fas fa-calendar-times"></i><h3>ไม่พบอีเวนท์</h3></div>';
        return;
    }
    
    try {
        const eventDays = getDaysBetween(currentEvent.startDate, currentEvent.endDate);
        const totalDays = eventDays.length;
        
        const journalsSnapshot = await db.collection('journals')
            .where('studentId', '==', currentUser.uid)
            .get();
        
        const completedDays = journalsSnapshot.docs.map(d => d.data().date);
        const completedCount = completedDays.filter(d => eventDays.includes(d)).length;
        const progress = Math.round((completedCount / totalDays) * 100);
        
        document.getElementById('journey-progress-bar').style.width = progress + '%';
        document.getElementById('journey-progress-text').textContent = `${completedCount}/${totalDays} วัน`;
        
        if (completedCount >= totalDays) {
            // All days completed - show journey
            incompleteDiv.classList.add('hidden');
            completeDiv.classList.remove('hidden');
            
            await generateJourneyPreview(journalsSnapshot.docs);
        } else {
            incompleteDiv.classList.remove('hidden');
            completeDiv.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('Error loading journey:', error);
    }
}

async function generateJourneyPreview(journalDocs) {
    const preview = document.getElementById('journey-preview');
    
    const journals = journalDocs.map(d => ({ id: d.id, ...d.data() }));
    journals.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate averages
    const avgCLO = {
        clo1: 0, clo2: 0, clo3: 0, clo4: 0
    };
    
    journals.forEach(j => {
        avgCLO.clo1 += j.clo1 || 0;
        avgCLO.clo2 += j.clo2 || 0;
        avgCLO.clo3 += j.clo3 || 0;
        avgCLO.clo4 += j.clo4 || 0;
    });
    
    const count = journals.length;
    Object.keys(avgCLO).forEach(k => {
        avgCLO[k] = (avgCLO[k] / count).toFixed(1);
    });
    
    // Get community notes
    const notesSnapshot = await db.collection('communityNotes')
        .where('studentId', '==', currentUser.uid)
        .get();
    
    const communityNotes = notesSnapshot.docs.map(d => d.data());
    
    preview.innerHTML = `
        <div class="journey-pdf-content" id="journey-pdf-content">
            <h1>🌟 Learning Journey</h1>
            <p class="subtitle">${currentUserData?.name || 'นักศึกษา'} | ${currentEvent?.name || 'Experiential Learning'}</p>
            
            <div class="journey-summary">
                <div class="summary-box">
                    <h4>CLO 1</h4>
                    <div class="value">${avgCLO.clo1}</div>
                    <small>เข้าใจปัญหาชุมชน</small>
                </div>
                <div class="summary-box">
                    <h4>CLO 2</h4>
                    <div class="value">${avgCLO.clo2}</div>
                    <small>สร้างสรรค์นวัตกรรม</small>
                </div>
                <div class="summary-box">
                    <h4>CLO 3</h4>
                    <div class="value">${avgCLO.clo3}</div>
                    <small>ทำงานร่วมกัน</small>
                </div>
                <div class="summary-box">
                    <h4>CLO 4</h4>
                    <div class="value">${avgCLO.clo4}</div>
                    <small>รับผิดชอบสังคม</small>
                </div>
            </div>
            
            <h2>📅 บันทึกรายวัน</h2>
            <div class="journey-days">
                ${journals.map(j => `
                    <div class="journey-day">
                        <h3>${formatDateThai(j.date)}</h3>
                        <p><strong>การเรียนรู้:</strong> ${j.learning || '-'}</p>
                        <p><strong>การนำไปใช้:</strong> ${j.application || '-'}</p>
                    </div>
                `).join('')}
            </div>
            
            ${communityNotes.length > 0 ? `
                <div class="community-giveback">
                    <h3>🤝 สิ่งที่ค้นพบจากชุมชน</h3>
                    ${communityNotes.map(n => `<p><strong>${n.title}:</strong> ${n.content}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

async function generateJourneyPDF() {
    const { jsPDF } = window.jspdf;
    
    showToast('กำลังสร้าง PDF...', 'info');
    
    try {
        const content = document.getElementById('journey-pdf-content');
        
        const canvas = await html2canvas(content, {
            scale: 2,
            useCORS: true
        });
        
        // A3 size in mm
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a3'
        });
        
        const imgWidth = 420; // A3 landscape width
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
        
        pdf.save(`Learning_Journey_${currentUserData?.name || 'Student'}.pdf`);
        
        showToast('ดาวน์โหลด PDF สำเร็จ', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('เกิดข้อผิดพลาดในการสร้าง PDF', 'error');
    }
}
