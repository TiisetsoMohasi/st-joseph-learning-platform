const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'st_joseph_high_school_secure_key_2026';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'school_platform.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_sessions (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    size TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL
  );
`);

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  const indexFile = path.join(__dirname, 'public', 'index.html');
  const legacyIndexFile = path.join(__dirname, 'public', 'index.html.html');

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  if (fs.existsSync(legacyIndexFile)) {
    return res.sendFile(legacyIndexFile);
  }

  res.status(404).send('Index file not found');
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage for up to 400MB Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 400 * 1024 * 1024 } // 400 MB Limit
});

// Persistent database-backed state (survives server restarts)
const ROLE_LIMITS = {
  administrator: 2,
  teacher: 30,
  student: Number.MAX_SAFE_INTEGER
};

const defaultUsers = [
  { id: 1, username: 'admin1', password: 'password', role: 'administrator', name: 'Admin - Sr. Mary' },
  { id: 2, username: 'admin2', password: 'password', role: 'administrator', name: 'Admin - Mr. Nkosi' },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: index + 3,
    username: `teacher${index + 1}`,
    password: 'password',
    role: 'teacher',
    name: `Teacher ${index + 1}`
  })),
  { id: 33, username: 'student1', password: 'password', role: 'student', name: 'Thabo M. (Form 4)' }
];

const defaultMaterials = [
  { id: 1, title: 'Introduction to Mechanics', type: 'video', url: '#', uploadedBy: 'Mr. Tiisetso', size: '45.2 MB' },
  { id: 2, title: 'Algebra Fundamentals PDF', type: 'document', url: '#', uploadedBy: 'Mr. Tiisetso', size: '2.1 MB' }
];

const defaultAuditLogs = [
  { timestamp: new Date().toISOString(), user: 'admin1', action: 'System session window set to 08:00-16:00' }
];

let users = [];
let learningSessions = { active: true, startTime: '08:00', endTime: '16:00' };
let materials = [];
let auditLogs = [];

function rowToUser(row) {
  return { id: row.id, username: row.username, password: row.password, role: row.role, name: row.name };
}

function rowToMaterial(row) {
  return { id: row.id, title: row.title, type: row.type, url: row.url, uploadedBy: row.uploaded_by, size: row.size };
}

function rowToAuditLog(row) {
  return { timestamp: row.timestamp, user: row.user_name, action: row.action };
}

function getRoleCounts() {
  return users.reduce((counts, user) => {
    counts[user.role] = (counts[user.role] || 0) + 1;
    return counts;
  }, { administrator: 0, teacher: 0, student: 0 });
}

function seedDatabaseIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) return;

  const insertUser = db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)');
  for (const user of defaultUsers) {
    insertUser.run(user.id, user.username, user.password, user.role, user.name);
  }

  const insertMaterial = db.prepare('INSERT INTO materials (id, title, type, url, uploaded_by, size) VALUES (?, ?, ?, ?, ?, ?)');
  for (const material of defaultMaterials) {
    insertMaterial.run(material.id, material.title, material.type, material.url, material.uploadedBy, material.size);
  }

  db.prepare('INSERT INTO learning_sessions (id, active, start_time, end_time) VALUES (1, ?, ?, ?)')
    .run(Number(learningSessions.active), learningSessions.startTime, learningSessions.endTime);

  const insertAuditLog = db.prepare('INSERT INTO audit_logs (timestamp, user_name, action) VALUES (?, ?, ?)');
  for (const log of defaultAuditLogs) {
    insertAuditLog.run(log.timestamp, log.user, log.action);
  }
}

function syncFromDatabase() {
  users = db.prepare('SELECT * FROM users ORDER BY id').all().map(rowToUser);

  const sessionRow = db.prepare('SELECT * FROM learning_sessions WHERE id = 1').get();
  learningSessions = sessionRow ? {
    active: Boolean(sessionRow.active),
    startTime: sessionRow.start_time,
    endTime: sessionRow.end_time
  } : { active: true, startTime: '08:00', endTime: '16:00' };

  materials = db.prepare('SELECT * FROM materials ORDER BY id').all().map(rowToMaterial);
  auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id').all().map(rowToAuditLog);
}

function syncToDatabase() {
  db.exec('DELETE FROM users');
  const insertUser = db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)');
  for (const user of users) {
    insertUser.run(user.id, user.username, user.password, user.role, user.name);
  }

  db.exec('DELETE FROM materials');
  const insertMaterial = db.prepare('INSERT INTO materials (id, title, type, url, uploaded_by, size) VALUES (?, ?, ?, ?, ?, ?)');
  for (const material of materials) {
    insertMaterial.run(material.id, material.title, material.type, material.url, material.uploadedBy, material.size);
  }

  db.exec('DELETE FROM learning_sessions');
  db.prepare('INSERT INTO learning_sessions (id, active, start_time, end_time) VALUES (1, ?, ?, ?)')
    .run(Number(learningSessions.active), learningSessions.startTime, learningSessions.endTime);

  db.exec('DELETE FROM audit_logs');
  const insertAuditLog = db.prepare('INSERT INTO audit_logs (timestamp, user_name, action) VALUES (?, ?, ?)');
  for (const log of auditLogs) {
    insertAuditLog.run(log.timestamp, log.user, log.action);
  }
}

seedDatabaseIfEmpty();
syncFromDatabase();

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Access token missing' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired session token' });
  }
};

// Role Check Middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized role permission' });
    }
    next();
  };
};

// Session Governance Middleware for Students
const enforceSchoolHours = (req, res, next) => {
  if (req.user.role === 'student' && !learningSessions.active) {
    return res.status(403).json({ error: 'Learning platform access is currently restricted by school administration policy.' });
  }
  next();
};

// --- API ENDPOINTS ---

// 1. Authentication
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const normalizedUsername = String(username || '').trim();
  const user = users.find(u => u.username.toLowerCase() === normalizedUsername.toLowerCase() && u.password === password);

  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });

  auditLogs.push({ timestamp: new Date().toISOString(), user: user.username, action: 'User logged in' });
  syncToDatabase();
  res.json({ token, role: user.role, name: user.name, username: user.username });
});

app.get('/api/admin/users', authenticate, authorize(['administrator']), (req, res) => {
  res.json(users.map(({ id, username, role, name }) => ({ id, username, role, name })));
});

app.post('/api/admin/register-user', authenticate, authorize(['administrator']), (req, res) => {
  const { fullName, username, password, role } = req.body || {};
  const trimmedName = String(fullName || '').trim();
  const trimmedUsername = String(username || '').trim();
  const trimmedPassword = String(password || '').trim();
  const userRole = String(role || '').trim().toLowerCase();

  if (!trimmedName || !trimmedUsername || !trimmedPassword || !userRole) {
    return res.status(400).json({ error: 'Full name, username, password, and role are required.' });
  }

  if (!['student', 'teacher', 'administrator'].includes(userRole)) {
    return res.status(400).json({ error: 'Role must be student, teacher, or administrator.' });
  }

  if (users.some(u => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
    return res.status(409).json({ error: 'A user with this username already exists.' });
  }

  const currentCounts = getRoleCounts();
  if (userRole === 'administrator' && currentCounts.administrator >= ROLE_LIMITS.administrator) {
    return res.status(400).json({ error: 'The system supports only 2 administrators.' });
  }

  if (userRole === 'teacher' && currentCounts.teacher >= ROLE_LIMITS.teacher) {
    return res.status(400).json({ error: 'The system supports up to 30 teachers.' });
  }

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username: trimmedUsername,
    password: trimmedPassword,
    role: userRole,
    name: trimmedName
  };

  users.push(newUser);
  auditLogs.push({
    timestamp: new Date().toISOString(),
    user: req.user.username,
    action: `Registered ${userRole}: ${newUser.name} (${newUser.username})`
  });
  syncToDatabase();

  res.status(201).json({
    message: 'User registered successfully',
    user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name }
  });
});

// 2. Fetch Materials (All Roles - Enforced for Students)
app.get('/api/materials', authenticate, enforceSchoolHours, (req, res) => {
  res.json(materials);
});

// 3. Teacher Video/Resource Upload (Up to 400MB)
app.post('/api/upload', authenticate, authorize(['teacher']), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const newMaterial = {
    id: materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1,
    title: req.body.title || req.file.originalname,
    type: req.file.mimetype.startsWith('video/') ? 'video' : 'document',
    url: `/uploads/${req.file.filename}`,
    uploadedBy: req.user.name,
    size: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`
  };

  materials.push(newMaterial);
  auditLogs.push({ timestamp: new Date().toISOString(), user: req.user.username, action: `Uploaded ${newMaterial.type}: ${newMaterial.title} (${newMaterial.size})` });
  syncToDatabase();

  res.json({ message: 'Resource successfully published', resource: newMaterial });
});

// 4. Admin Governance: Session Controls
app.post('/api/admin/session', authenticate, authorize(['administrator']), (req, res) => {
  learningSessions.active = req.body.active;
  auditLogs.push({ timestamp: new Date().toISOString(), user: req.user.username, action: `Set platform active status to: ${req.body.active}` });
  syncToDatabase();
  res.json({ message: 'Governance policy updated successfully', learningSessions });
});

// 5. Admin Governance: Audit Logs
app.get('/api/admin/logs', authenticate, authorize(['administrator']), (req, res) => {
  res.json(auditLogs);
});

app.listen(PORT, () => console.log(`St Joseph High School Portal running on http://localhost:${PORT}`));