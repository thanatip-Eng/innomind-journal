// =====================================================
// Firebase Configuration
// =====================================================
// *** สำคัญ: แทนที่ค่าเหล่านี้ด้วย config จาก Firebase Console ***

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// =====================================================
// Gemini API Configuration
// =====================================================
// *** สำคัญ: แทนที่ด้วย API Key จาก Google AI Studio ***

const GEMINI_API_KEY = AIzaSyCbULGksJDB5pkSm0mu9eCrfXrwRzVA1C0;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// =====================================================
// Initialize Firebase
// =====================================================
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// =====================================================
// CLO Definitions (Course Learning Outcomes)
// =====================================================
const CLO_DEFINITIONS = {
    clo1: {
        name: "การทำความเข้าใจและแก้ปัญหาชุมชนอย่างสร้างสรรค์",
        description: "นักศึกษาสามารถทำความเข้าใจและวิเคราะห์ปัญหาของชุมชนได้อย่างลึกซึ้ง",
        shortName: "เข้าใจปัญหาชุมชน"
    },
    clo2: {
        name: "การร่วมสร้างสรรค์และพัฒนาต้นแบบนวัตกรรม",
        description: "นักศึกษาสามารถร่วมสร้างสรรค์กับชุมชนเพื่อพัฒนาและสร้างต้นแบบแนวทางแก้ไขปัญหาที่เป็นนวัตกรรม ยั่งยืน และรับมือกับความเปลี่ยนแปลงได้",
        shortName: "สร้างสรรค์นวัตกรรม"
    },
    clo3: {
        name: "การสื่อสารและทำงานร่วมกับผู้อื่นอย่างมีประสิทธิภาพ",
        description: "นักศึกษาสามารถสื่อสารและทำงานร่วมกับทีมที่มีความหลากหลาย",
        shortName: "ทำงานร่วมกับผู้อื่น"
    },
    clo4: {
        name: "การเติบโตส่วนบุคคลและความรับผิดชอบต่อสังคม",
        description: "นักศึกษาสามารถจัดการตนเอง รับผิดชอบต่อสังคม และมีความยืดหยุ่นในการรับมือกับการเปลี่ยนแปลง เพื่อเป็นส่วนหนึ่งของการสร้างสรรค์สิ่งที่ดีขึ้นสำหรับผู้อื่น",
        shortName: "รับผิดชอบต่อสังคม"
    }
};

// =====================================================
// Helper Functions
// =====================================================

// Format date to Thai
function formatDateThai(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return new Date(date).toLocaleDateString('th-TH', options);
}

// Format date short
function formatDateShort(date) {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// Get date string (YYYY-MM-DD)
function getDateString(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

// Get days between two dates
function getDaysBetween(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        days.push(getDateString(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Show toast notification
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show/hide loading
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// =====================================================
// Gemini AI Functions
// =====================================================

async function callGeminiAPI(prompt) {
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Gemini API request failed');
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
}

async function analyzeStudentSkillGap(studentJournals, studentName) {
    const journalSummary = studentJournals.map(j => {
        return `
วันที่: ${formatDateShort(j.date)}
การเรียนรู้: ${j.learning || 'ไม่ได้ระบุ'}
ความรู้สึก: ${j.feeling || 'ไม่ได้ระบุ'}
การนำไปใช้: ${j.application || 'ไม่ได้ระบุ'}
CLO Scores: CLO1=${j.clo1 || 0}, CLO2=${j.clo2 || 0}, CLO3=${j.clo3 || 0}, CLO4=${j.clo4 || 0}
        `;
    }).join('\n---\n');
    
    const prompt = `
คุณเป็นที่ปรึกษาด้านการพัฒนานักศึกษา วิเคราะห์ Skill Gap และให้คำแนะนำการพัฒนาสำหรับนักศึกษาชื่อ "${studentName}" จากบันทึก Reflection ต่อไปนี้:

${journalSummary}

CLO ที่ใช้ประเมิน:
- CLO1: การทำความเข้าใจและแก้ปัญหาชุมชนอย่างสร้างสรรค์
- CLO2: การร่วมสร้างสรรค์และพัฒนาต้นแบบนวัตกรรม
- CLO3: การสื่อสารและทำงานร่วมกับผู้อื่นอย่างมีประสิทธิภาพ
- CLO4: การเติบโตส่วนบุคคลและความรับผิดชอบต่อสังคม

กรุณาวิเคราะห์และตอบในรูปแบบ:
1. จุดแข็งที่พบ (2-3 ข้อ)
2. Skill Gap ที่ควรพัฒนา (2-3 ข้อ พร้อมระบุ CLO ที่เกี่ยวข้อง)
3. คำแนะนำเชิงปฏิบัติ (2-3 ข้อ)

ตอบเป็นภาษาไทย กระชับ เข้าใจง่าย
    `;
    
    return await callGeminiAPI(prompt);
}

async function generateLearningJourneySummary(studentJournals, communityNotes, studentName) {
    const journalSummary = studentJournals.map(j => {
        return `
วันที่: ${formatDateShort(j.date)}
การเรียนรู้: ${j.learning || 'ไม่ได้ระบุ'}
การนำไปใช้: ${j.application || 'ไม่ได้ระบุ'}
        `;
    }).join('\n');
    
    const notesSummary = communityNotes.map(n => {
        return `หัวข้อ: ${n.title}\nรายละเอียด: ${n.content}`;
    }).join('\n---\n');
    
    const prompt = `
สร้างสรุป Learning Journey สำหรับนักศึกษาชื่อ "${studentName}" จากข้อมูลต่อไปนี้:

## บันทึก Reflection รายวัน:
${journalSummary}

## สิ่งที่ค้นพบจากชุมชน:
${notesSummary || 'ไม่มีข้อมูล'}

กรุณาสรุป:
1. ภาพรวมการเรียนรู้ตลอดกิจกรรม (3-4 ประโยค)
2. การเติบโตที่เห็นได้ชัด (2-3 ข้อ)
3. สิ่งที่อยากคืนให้ชุมชน / สิ่งที่จะนำไปต่อยอด (2-3 ข้อ)

ตอบเป็นภาษาไทย เขียนในมุมมองบุคคลที่สาม สร้างแรงบันดาลใจ
    `;
    
    return await callGeminiAPI(prompt);
}
