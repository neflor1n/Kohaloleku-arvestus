// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initializeApp();
});

// Global state
let teachers = [];
let students = [];
let currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
let selectedTeacherId = '';
let currentLesson = '';

// Initialize the application
function initializeApp() {
  // Set current date as default
  document.getElementById('date-picker').value = currentDate;
  document.getElementById('date-picker').addEventListener('change', (e) => {
    currentDate = e.target.value;
    renderAttendanceList();
  });
  
  // Lesson input
  document.getElementById('lesson-input').addEventListener('input', (e) => {
    currentLesson = e.target.value;
    renderAttendanceList();
  });

  // Teacher selector
  document.getElementById('teacher-select').addEventListener('change', (e) => {
    selectedTeacherId = e.target.value;
    if (selectedTeacherId) {
      fetchStudents(selectedTeacherId);
      fetchStatistics(selectedTeacherId);
    } else {
      students = [];
      renderAttendanceList();
      renderStudentList();
    }
  });

  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
      
      // Load data specific to the tab
      if (tabName === 'statistics' && selectedTeacherId) {
        fetchStatistics(selectedTeacherId);
      }
    });
  });

  // Add event listeners
  document.getElementById('add-student-button').addEventListener('click', addStudent);
  document.getElementById('add-teacher-button').addEventListener('click', addTeacher);
  document.getElementById('export-button').addEventListener('click', exportAttendance);

  // Initial data fetch
  fetchTeachers();
}

// Switch between tabs
function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show selected tab content and set button as active
  document.getElementById(`${tabName}-tab`).classList.remove('hidden');
  document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
}

// Fetch all teachers from the server
async function fetchTeachers() {
  try {
    const response = await fetch('/api/teachers');
    if (!response.ok) throw new Error('Failed to fetch teachers');
    
    teachers = await response.json();
    renderTeacherList();
    updateTeacherSelector();
  } catch (error) {
    console.error('Error fetching teachers:', error);
    alert('Viga õpetajate laadimisel. Palun proovige uuesti.');
  }
}

// Fetch all students for a teacher from the server
async function fetchStudents(teacherId) {
  try {
    const response = await fetch(`/api/students?teacherId=${teacherId}`);
    if (!response.ok) throw new Error('Failed to fetch students');
    
    students = await response.json();
    renderAttendanceList();
    renderStudentList();
  } catch (error) {
    console.error('Error fetching students:', error);
    alert('Viga õpilaste laadimisel. Palun proovige uuesti.');
  }
}

// Update teacher selector dropdown
function updateTeacherSelector() {
  const selector = document.getElementById('teacher-select');
  
  // Keep the first option and remove the rest
  while (selector.options.length > 1) {
    selector.remove(1);
  }
  
  // Add teachers to the selector
  teachers.forEach(teacher => {
    const option = document.createElement('option');
    option.value = teacher.id;
    option.textContent = `${teacher.name} (${teacher.subject})`;
    selector.appendChild(option);
  });
}

// Render the teacher list
function renderTeacherList() {
  const container = document.getElementById('teacher-records');
  container.innerHTML = '';
  
  if (teachers.length === 0) {
    container.innerHTML = '<div class="empty-state">Ühtegi õpetajat pole lisatud.</div>';
    return;
  }
  
  teachers.forEach(teacher => {
    const teacherStudents = students.filter(s => s.teacherId === teacher.id);
    
    const element = document.createElement('div');
    element.className = `teacher-record ${teacher.id === selectedTeacherId ? 'selected' : ''}`;
    element.dataset.id = teacher.id;
    element.innerHTML = `
      <div>${teacher.name}</div>
      <div>${teacher.subject}</div>
      <div>${teacherStudents.length}</div>
    `;
    
    // Add click event to select teacher
    element.addEventListener('click', () => {
      selectedTeacherId = teacher.id;
      
      // Update teacher selector
      document.getElementById('teacher-select').value = selectedTeacherId;
      
      // Update selected class
      document.querySelectorAll('.teacher-record').forEach(el => {
        el.classList.remove('selected');
      });
      element.classList.add('selected');
      
      // Fetch students for this teacher
      fetchStudents(selectedTeacherId);
    });
    
    container.appendChild(element);
  });
}

// Render the attendance list for the current date and lesson
function renderAttendanceList() {
  const container = document.getElementById('attendance-records');
  container.innerHTML = '';
  
  if (!selectedTeacherId) {
    container.innerHTML = '<div class="empty-state">Palun valige õpetaja.</div>';
    return;
  }
  
  if (students.length === 0) {
    container.innerHTML = '<div class="empty-state">Ühtegi õpilast pole lisatud. Palun lisa õpilased "Õpilased" vahekaardil.</div>';
    return;
  }
  
  if (!currentLesson) {
    container.innerHTML = '<div class="empty-state">Palun sisestage tunni nimi.</div>';
    return;
  }
  
  students.forEach(student => {
    // Find attendance record for current date and lesson
    const record = student.attendanceRecords.find(r => r.date === currentDate && r.lesson === currentLesson);
    const status = record ? record.status : '';
    const reason = record ? record.reason : '';
    
    const element = document.createElement('div');
    element.className = 'attendance-record';
    element.innerHTML = `
      <div>${student.name}</div>
      <div class="status-selector">
        <button class="status-button present ${status === 'present' ? 'selected' : ''}" 
                data-student="${student.id}" data-status="present">
          <i data-lucide="check"></i> Kohal
        </button>
        <button class="status-button absent ${status === 'absent' ? 'selected' : ''}" 
                data-student="${student.id}" data-status="absent">
          <i data-lucide="x"></i> Puudub
        </button>
        <button class="status-button late ${status === 'late' ? 'selected' : ''}" 
                data-student="${student.id}" data-status="late">
          <i data-lucide="clock"></i> Hilineb
        </button>
      </div>
      <div>
        <input type="text" class="reason-input" 
               placeholder="Põhjus" 
               data-student="${student.id}" 
               value="${reason || ''}">
      </div>
      <div>${currentLesson}</div>
    `;
    
    container.appendChild(element);
    
    // Add event listeners to status buttons
    const statusButtons = element.querySelectorAll('.status-button');
    statusButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove selected class from all buttons in this group
        statusButtons.forEach(btn => btn.classList.remove('selected'));
        // Add selected class to clicked button
        button.classList.add('selected');
        
        updateAttendance(button.dataset.student, button.dataset.status);
      });
    });
    
    // Add event listener to reason input
    const reasonInput = element.querySelector('.reason-input');
    reasonInput.addEventListener('blur', () => {
      // Get the current status for this student
      const currentRecord = students.find(s => s.id === reasonInput.dataset.student)
        ?.attendanceRecords.find(r => r.date === currentDate && r.lesson === currentLesson);
      
      // Only update if there's a status
      if (currentRecord) {
        updateAttendance(reasonInput.dataset.student, currentRecord.status, reasonInput.value);
      }
    });
  });
  
  // Re-initialize Lucide icons for the new elements
  lucide.createIcons();
}

// Render the student list with statistics
function renderStudentList() {
  const container = document.getElementById('student-records');
  container.innerHTML = '';
  
  if (!selectedTeacherId) {
    container.innerHTML = '<div class="empty-state">Palun valige õpetaja.</div>';
    return;
  }
  
  if (students.length === 0) {
    container.innerHTML = '<div class="empty-state">Ühtegi õpilast pole lisatud.</div>';
    return;
  }
  
  students.forEach(student => {
    const absences = student.attendanceRecords.filter(r => r.status === 'absent').length;
    const lates = student.attendanceRecords.filter(r => r.status === 'late').length;
    
    const element = document.createElement('div');
    element.className = 'student-record';
    element.innerHTML = `
      <div>${student.name}</div>
      <div>${absences}</div>
      <div>${lates}</div>
    `;
    
    container.appendChild(element);
  });
}

// Add a new teacher
async function addTeacher() {
  const nameInput = document.getElementById('teacher-name');
  const subjectInput = document.getElementById('teacher-subject');
  
  const name = nameInput.value.trim();
  const subject = subjectInput.value.trim();
  
  if (!name || !subject) {
    alert('Palun sisestage õpetaja nimi ja õppeaine.');
    return;
  }
  
  try {
    const response = await fetch('/api/teachers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, subject })
    });
    
    if (!response.ok) throw new Error('Failed to add teacher');
    
    const newTeacher = await response.json();
    teachers.push(newTeacher);
    
    nameInput.value = '';
    subjectInput.value = '';
    renderTeacherList();
    updateTeacherSelector();
  } catch (error) {
    console.error('Error adding teacher:', error);
    alert('Viga õpetaja lisamisel. Palun proovige uuesti.');
  }
}

// Add a new student
async function addStudent() {
  if (!selectedTeacherId) {
    alert('Palun valige õpetaja enne õpilase lisamist.');
    return;
  }
  
  const nameInput = document.getElementById('student-name');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('Palun sisestage õpilase nimi.');
    return;
  }
  
  try {
    const response = await fetch('/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, teacherId: selectedTeacherId })
    });
    
    if (!response.ok) throw new Error('Failed to add student');
    
    const newStudent = await response.json();
    students.push(newStudent);
    
    nameInput.value = '';
    renderAttendanceList();
    renderStudentList();
  } catch (error) {
    console.error('Error adding student:', error);
    alert('Viga õpilase lisamisel. Palun proovige uuesti.');
  }
}

// Update attendance status for a student
async function updateAttendance(studentId, status, reason) {
  if (!currentLesson) {
    alert('Palun sisestage tunni nimi.');
    return;
  }
  
  // Find the student and their existing record for this date
  const student = students.find(s => s.id === studentId);
  const recordIndex = student.attendanceRecords.findIndex(
    r => r.date === currentDate && r.lesson === currentLesson
  );
  
  // Get reason from input if not provided
  if (reason === undefined) {
    const reasonInput = document.querySelector(`.reason-input[data-student="${studentId}"]`);
    reason = reasonInput ? reasonInput.value : '';
  }
  
  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        studentId, 
        date: currentDate, 
        lesson: currentLesson,
        status, 
        reason
      })
    });
    
    if (!response.ok) throw new Error('Failed to update attendance');
    
    const updatedStudent = await response.json();
    
    // Update local data
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
      students[studentIndex] = updatedStudent;
    }
  } catch (error) {
    console.error('Error updating attendance:', error);
    alert('Viga kohaloleku uuendamisel. Palun proovige uuesti.');
  }
}

// Fetch class statistics
async function fetchStatistics(teacherId) {
  try {
    const response = await fetch(`/api/statistics?teacherId=${teacherId}`);
    if (!response.ok) throw new Error('Failed to fetch statistics');
    
    const statistics = await response.json();
    updateStatisticsDisplay(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    alert('Viga statistika laadimisel. Palun proovige uuesti.');
  }
}

// Update the statistics display
function updateStatisticsDisplay(statistics) {
  document.getElementById('attendance-rate').textContent = `${statistics.attendanceRate}%`;
  document.getElementById('student-count').textContent = statistics.studentCount;
  document.getElementById('absence-count').textContent = statistics.totalAbsent;
  document.getElementById('late-count').textContent = statistics.totalLate;
  
  // Create chart
  renderAttendanceChart(statistics);
}

// Render the attendance chart
function renderAttendanceChart(statistics) {
  const ctx = document.getElementById('attendance-chart').getContext('2d');
  
  // Destroy existing chart if there is one
  if (window.attendanceChart) {
    window.attendanceChart.destroy();
  }
  
  window.attendanceChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Kohal', 'Puudub', 'Hilineb'],
      datasets: [{
        data: [
          statistics.totalPresent,
          statistics.totalAbsent,
          statistics.totalLate
        ],
        backgroundColor: [
          '#2ecc71', // Green for present
          '#e74c3c', // Red for absent
          '#f39c12'  // Orange for late
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// Export attendance data to CSV
async function exportAttendance() {
  if (!selectedTeacherId) {
    alert('Palun valige õpetaja enne andmete eksportimist.');
    return;
  }
  
  try {
    // Trigger the server's CSV export endpoint
    const response = await fetch(`/api/export?teacherId=${selectedTeacherId}`);
    if (!response.ok) throw new Error('Failed to export data');
    
    // Convert response to blob
    const blob = await response.blob();
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `kohaloleku_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } catch (error) {
    console.error('Error exporting attendance:', error);
    alert('Viga andmete eksportimisel. Palun proovige uuesti.');
  }
}
