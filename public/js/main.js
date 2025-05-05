// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initializeApp();
  });
  
  // Global state
  let students = [];
  let currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // Initialize the application
  function initializeApp() {
    // Set current date as default
    document.getElementById('date-picker').value = currentDate;
    document.getElementById('date-picker').addEventListener('change', (e) => {
      currentDate = e.target.value;
      renderAttendanceList();
    });
  
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        switchTab(tabName);
        
        // Load data specific to the tab
        if (tabName === 'statistics') {
          fetchStatistics();
        }
      });
    });
  
    // Add event listeners
    document.getElementById('add-student-button').addEventListener('click', addStudent);
    document.getElementById('export-button').addEventListener('click', exportAttendance);
  
    // Initial data fetch
    fetchStudents();
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
  
  // Fetch all students from the server
  async function fetchStudents() {
    try {
      const response = await fetch('/api/students');
      if (!response.ok) throw new Error('Failed to fetch students');
      
      students = await response.json();
      renderAttendanceList();
      renderStudentList();
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Viga õpilaste laadimisel. Palun proovige uuesti.');
    }
  }
  
  // Render the attendance list for the current date
  function renderAttendanceList() {
    const container = document.getElementById('attendance-records');
    container.innerHTML = '';
    
    if (students.length === 0) {
      container.innerHTML = '<div class="empty-state">Ühtegi õpilast pole lisatud. Palun lisa õpilased "Õpilased" vahekaardil.</div>';
      return;
    }
    
    students.forEach(student => {
      // Find attendance record for current date
      const record = student.attendanceRecords.find(r => r.date === currentDate);
      const status = record ? record.status : '';
      const reason = record ? record.reason : '';
      
      const element = document.createElement('div');
      element.className = 'attendance-record';
      element.innerHTML = `
        <div>${student.name}</div>
        <div class="status-selector">
          <button class="status-button present ${status === 'present' ? 'active' : ''}" 
                  data-student="${student.id}" data-status="present">
            <i data-lucide="check"></i> Kohal
          </button>
          <button class="status-button absent ${status === 'absent' ? 'active' : ''}" 
                  data-student="${student.id}" data-status="absent">
            <i data-lucide="x"></i> Puudub
          </button>
          <button class="status-button late ${status === 'late' ? 'active' : ''}" 
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
      `;
      
      container.appendChild(element);
      
      // Add event listeners to status buttons
      const statusButtons = element.querySelectorAll('.status-button');
      statusButtons.forEach(button => {
        button.addEventListener('click', () => {
          updateAttendance(button.dataset.student, button.dataset.status);
        });
      });
      
      // Add event listener to reason input
      const reasonInput = element.querySelector('.reason-input');
      reasonInput.addEventListener('blur', () => {
        // Get the current status for this student
        const currentRecord = students.find(s => s.id === reasonInput.dataset.student)
          ?.attendanceRecords.find(r => r.date === currentDate);
        
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
  
  // Add a new student
  async function addStudent() {
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
        body: JSON.stringify({ name })
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
    // Find the student and their existing record for this date
    const student = students.find(s => s.id === studentId);
    const recordIndex = student.attendanceRecords.findIndex(r => r.date === currentDate);
    
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
      
      // Update UI to reflect changes
      renderAttendanceList();
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Viga kohaloleku uuendamisel. Palun proovige uuesti.');
    }
  }
  
  // Fetch class statistics
  async function fetchStatistics() {
    try {
      const response = await fetch('/api/statistics');
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
    try {
      // Trigger the server's CSV export endpoint
      const response = await fetch('/api/export');
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