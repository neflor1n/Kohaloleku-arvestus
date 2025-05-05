const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Parser } = require('json2csv');

const app = express();
const PORT = process.env.PORT || 3000;
const dataPath = path.join(__dirname, 'data', 'students.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize empty data file if it doesn't exist
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify({ students: [] }));
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
// Get all students
app.get('/api/students', (req, res) => {
  const data = readData();
  res.json(data.students);
});

// Add a new student
app.post('/api/students', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Student name is required' });
  }
  
  const data = readData();
  const newStudent = {
    id: Date.now().toString(),
    name,
    attendanceRecords: []
  };
  
  data.students.push(newStudent);
  writeData(data);
  
  res.status(201).json(newStudent);
});

// Update attendance for a student
app.post('/api/attendance', (req, res) => {
  const { studentId, date, status, reason } = req.body;
  
  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'Student ID, date, and status are required' });
  }
  
  const data = readData();
  const studentIndex = data.students.findIndex(s => s.id === studentId);
  
  if (studentIndex === -1) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  // Check if there's already a record for this date
  const recordIndex = data.students[studentIndex].attendanceRecords.findIndex(
    record => record.date === date
  );
  
  if (recordIndex !== -1) {
    // Update existing record
    data.students[studentIndex].attendanceRecords[recordIndex] = {
      date,
      status,
      reason: reason || ''
    };
  } else {
    // Add new record
    data.students[studentIndex].attendanceRecords.push({
      date,
      status,
      reason: reason || ''
    });
  }
  
  writeData(data);
  res.json(data.students[studentIndex]);
});

// Export attendance data to CSV
app.get('/api/export', (req, res) => {
  const data = readData();
  
  // Get all unique dates
  const allDates = new Set();
  data.students.forEach(student => {
    student.attendanceRecords.forEach(record => {
      allDates.add(record.date);
    });
  });
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create CSV data
  const csvData = data.students.map(student => {
    const row = { Name: student.name };
    
    // Add a column for each date
    sortedDates.forEach(date => {
      const record = student.attendanceRecords.find(r => r.date === date);
      row[date] = record ? record.status : 'N/A';
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
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
  res.send(csv);
});

// Get class statistics
app.get('/api/statistics', (req, res) => {
  const data = readData();
  
  let totalRecords = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  
  data.students.forEach(student => {
    totalRecords += student.attendanceRecords.length;
    totalPresent += student.attendanceRecords.filter(r => r.status === 'present').length;
    totalAbsent += student.attendanceRecords.filter(r => r.status === 'absent').length;
    totalLate += student.attendanceRecords.filter(r => r.status === 'late').length;
  });
  
  const statistics = {
    studentCount: data.students.length,
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});