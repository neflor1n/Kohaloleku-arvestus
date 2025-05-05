const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Parser } = require('json2csv');

const app = express();
const PORT = process.env.PORT || 3000;
const dataPath = path.join(__dirname, 'data', 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize empty data file if it doesn't exist
if (!fs.existsSync(dataPath)) {
  const initialData = {
    teachers: [],
    students: []
  };
  fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2));
}

// Helper functions
const readData = () => {
  const data = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(data);
};

const writeData = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

// Routes
// Get all teachers
app.get('/api/teachers', (req, res) => {
  const data = readData();
  res.json(data.teachers);
});

// Add a new teacher
app.post('/api/teachers', (req, res) => {
  const { name, subject } = req.body;
  
  if (!name || !subject) {
    return res.status(400).json({ error: 'Teacher name and subject are required' });
  }
  
  const data = readData();
  const newTeacher = {
    id: Date.now().toString(),
    name,
    subject
  };
  
  data.teachers.push(newTeacher);
  writeData(data);
  
  res.status(201).json(newTeacher);
});

// Get all students for a teacher
app.get('/api/students', (req, res) => {
  const teacherId = req.query.teacherId;
  
  if (!teacherId) {
    const data = readData();
    return res.json(data.students);
  }
  
  const data = readData();
  const teacherStudents = data.students.filter(student => student.teacherId === teacherId);
  res.json(teacherStudents);
});

// Add a new student
app.post('/api/students', (req, res) => {
  const { name, teacherId } = req.body;
  
  if (!name || !teacherId) {
    return res.status(400).json({ error: 'Student name and teacher ID are required' });
  }
  
  const data = readData();
  // Check if the teacher exists
  const teacher = data.teachers.find(t => t.id === teacherId);
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  
  const newStudent = {
    id: Date.now().toString(),
    name,
    teacherId,
    attendanceRecords: []
  };
  
  data.students.push(newStudent);
  writeData(data);
  
  res.status(201).json(newStudent);
});

// Update attendance for a student
app.post('/api/attendance', (req, res) => {
  const { studentId, date, status, reason, lesson } = req.body;
  
  if (!studentId || !date || !status || !lesson) {
    return res.status(400).json({ error: 'Student ID, date, status, and lesson are required' });
  }
  
  const data = readData();
  const studentIndex = data.students.findIndex(s => s.id === studentId);
  
  if (studentIndex === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  // Check if there's already a record for this date and lesson
  const recordIndex = data.students[studentIndex].attendanceRecords.findIndex(
    record => record.date === date && record.lesson === lesson
  );
  
  if (recordIndex !== -1) {
    // Update existing record
    data.students[studentIndex].attendanceRecords[recordIndex] = {
      date,
      lesson,
      status,
      reason: reason || ''
    };
  } else {
    // Add new record
    data.students[studentIndex].attendanceRecords.push({
      date,
      lesson,
      status,
      reason: reason || ''
    });
  }
  
  writeData(data);
  res.json(data.students[studentIndex]);
});

// Export attendance data to CSV
app.get('/api/export', (req, res) => {
  const teacherId = req.query.teacherId;
  
  if (!teacherId) {
    return res.status(400).json({ error: 'Teacher ID is required' });
  }
  
  const data = readData();
  const teacher = data.teachers.find(t => t.id === teacherId);
  
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  
  // Get students for this teacher
  const teacherStudents = data.students.filter(s => s.teacherId === teacherId);
  
  // Get all unique dates
  const allDatesAndLessons = new Set();
  teacherStudents.forEach(student => {
    student.attendanceRecords.forEach(record => {
      allDatesAndLessons.add(`${record.date}-${record.lesson}`);
    });
  });
  
  const sortedDatesAndLessons = Array.from(allDatesAndLessons).sort();
  
  // Create CSV data
  const csvData = teacherStudents.map(student => {
    const row = { Name: student.name };
    
    // Add a column for each date-lesson
    sortedDatesAndLessons.forEach(dateLessonKey => {
      const [date, lesson] = dateLessonKey.split('-');
      const record = student.attendanceRecords.find(r => r.date === date && r.lesson === lesson);
      row[`${date} (${lesson})`] = record ? record.status : 'N/A';
    });
    
    // Calculate statistics
    const absences = student.attendanceRecords.filter(r => r.status === 'absent').length;
    const lates = student.attendanceRecords.filter(r => r.status === 'late').length;
    const present = student.attendanceRecords.filter(r => r.status === 'present').length;
    const total = student.attendanceRecords.length;
    
    row['Total Absences'] = absences;
    row['Total Late'] = lates;
    row['Attendance Rate'] = total > 0 ? `${(present / total * 100).toFixed(2)}%` : 'N/A';
    
    return row;
  });
  
  // Convert to CSV
  const parser = new Parser();
  const csv = parser.parse(csvData);
  
  const fileName = `kohaloleku_${teacher.name}_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
});

// Get statistics for a teacher
app.get('/api/statistics', (req, res) => {
  const teacherId = req.query.teacherId;
  
  if (!teacherId) {
    return res.status(400).json({ error: 'Teacher ID is required' });
  }
  
  const data = readData();
  
  // Get students for this teacher
  const teacherStudents = data.students.filter(s => s.teacherId === teacherId);
  
  let totalRecords = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  
  teacherStudents.forEach(student => {
    totalRecords += student.attendanceRecords.length;
    totalPresent += student.attendanceRecords.filter(r => r.status === 'present').length;
    totalAbsent += student.attendanceRecords.filter(r => r.status === 'absent').length;
    totalLate += student.attendanceRecords.filter(r => r.status === 'late').length;
  });
  
  const statistics = {
    studentCount: teacherStudents.length,
    attendanceRate: totalRecords > 0 ? (totalPresent / totalRecords * 100).toFixed(2) : 0,
    absentRate: totalRecords > 0 ? (totalAbsent / totalRecords * 100).toFixed(2) : 0,
    lateRate: totalRecords > 0 ? (totalLate / totalRecords * 100).toFixed(2) : 0,
    totalRecords,
    totalPresent,
    totalAbsent,
    totalLate
  };
  
  res.json(statistics);
});

// Route for root - ensure index.html is served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
