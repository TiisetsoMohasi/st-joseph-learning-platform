const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const jwt = require("jsonwebtoken")
const { DatabaseSync } = require("node:sqlite")

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = "st_joseph_high_school_secure_key_2026"
const DATA_DIR = path.join(__dirname, "data")
const DB_PATH = path.join(DATA_DIR, "school_platform.db")

fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT
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

  CREATE TABLE IF NOT EXISTS discussions (
    id INTEGER PRIMARY KEY,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_email TEXT NOT NULL,
    question TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

app.use(express.json())
app.use(express.static(path.join(__dirname, "dist")))

app.get("/", (req, res) => {
  const builtIndexFile = path.join(__dirname, "dist", "index.html")

  if (fs.existsSync(builtIndexFile)) {
    return res.sendFile(builtIndexFile)
  }

  res
    .status(503)
    .send(
      "Frontend build not found. Run npm run build or npm run dev to launch the app.",
    )
})

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "public/uploads")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
app.use("/uploads", express.static(uploadDir))

// Configure Storage for up to 400MB Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`,
    )
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 400 * 1024 * 1024 }, // 400 MB Limit
})

// Persistent database-backed state (survives server restarts)
const ROLE_LIMITS = {
  administrator: 2,
  teacher: 6,
  student: 40,
}

const defaultUsers = [
  {
    id: 1,
    username: "admin1",
    password: "password",
    role: "administrator",
    name: "Admin - Sr. Mary",
    email: "admin1@stjoseph.com",
  },
  {
    id: 2,
    username: "admin2",
    password: "password",
    role: "administrator",
    name: "Admin - Mr. Nkosi",
    email: "admin2@stjoseph.com",
  },
  ...Array.from({ length: ROLE_LIMITS.teacher }, (_, index) => ({
    id: index + 3,
    username: `teacher${index + 1}@stjoseph.co.ls`,
    password: `teacher${index + 1}@112`,
    role: "teacher",
    name: `Teacher ${index + 1}`,
    email: `teacher${index + 1}@stjoseph.co.ls`,
  })),
  ...Array.from({ length: ROLE_LIMITS.student }, (_, index) => ({
    id: index + 33,
    username: `student${index + 1}@stjoseph.com`,
    password: `student${index + 1}@112`,
    role: "student",
    name: index === 0 ? "Thabo M. (Form 4)" : `Student ${index + 1}`,
    email: `student${index + 1}@stjoseph.com`,
  })),
]

const defaultMaterials = [
  {
    id: 1,
    title: "Introduction to Mechanics",
    type: "video",
    url: "#",
    uploadedBy: "Mr. Tiisetso",
    size: "45.2 MB",
  },
  {
    id: 2,
    title: "Algebra Fundamentals PDF",
    type: "document",
    url: "#",
    uploadedBy: "Mr. Tiisetso",
    size: "2.1 MB",
  },
]

const defaultAuditLogs = [
  {
    timestamp: new Date().toISOString(),
    user: "admin1",
    action: "System session window set to 08:00-16:00",
  },
]

let users = []
let learningSessions = { active: true, startTime: "08:00", endTime: "16:00" }
let materials = []
let auditLogs = []
let discussionPosts = []

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
    name: row.name,
    email: row.email || row.username,
  }
}

function normalizeNamePart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\s'-]/g, "")
    .trim()
    .toLowerCase()
}

function generateAutoCredentials(fullName, role) {
  const cleanName = String(fullName || "").trim()
  const parts = cleanName.split(/\s+/).filter(Boolean)
  const firstName = normalizeNamePart(parts[0] || "user")
  const lastName =
    normalizeNamePart(parts.length > 1 ? parts[parts.length - 1] : firstName) ||
    "user"
  const domain = role === "teacher" ? "stjoseph.co.ls" : "stjoseph.com"
  let email = `${firstName}.${lastName}@${domain}`
  let counter = 2

  while (
    users.some(
      (user) =>
        (user.email || user.username).toLowerCase() === email.toLowerCase(),
    )
  ) {
    email = `${firstName}.${lastName}${counter}@${domain}`
    counter += 1
  }

  return {
    username: email,
    email,
    password: `${firstName}@112`,
  }
}

function rowToMaterial(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    url: row.url,
    uploadedBy: row.uploaded_by,
    size: row.size,
  }
}

function rowToAuditLog(row) {
  return { timestamp: row.timestamp, user: row.user_name, action: row.action }
}

function getRoleCounts() {
  return users.reduce(
    (counts, user) => {
      counts[user.role] = (counts[user.role] || 0) + 1
      return counts
    },
    { administrator: 0, teacher: 0, student: 0 },
  )
}

function syncFromDatabase() {
  users = db.prepare("SELECT * FROM users ORDER BY id").all().map(rowToUser)

  const sessionRow = db
    .prepare("SELECT * FROM learning_sessions WHERE id = 1")
    .get()
  learningSessions = sessionRow
    ? {
        active: Boolean(sessionRow.active),
        startTime: sessionRow.start_time,
        endTime: sessionRow.end_time,
      }
    : { active: true, startTime: "08:00", endTime: "16:00" }

  materials = db
    .prepare("SELECT * FROM materials ORDER BY id")
    .all()
    .map(rowToMaterial)
  auditLogs = db
    .prepare("SELECT * FROM audit_logs ORDER BY id")
    .all()
    .map(rowToAuditLog)
  discussionPosts = db
    .prepare("SELECT * FROM discussions ORDER BY id")
    .all()
    .map((row) => ({
      id: row.id,
      userName: row.user_name,
      userRole: row.user_role,
      userEmail: row.user_email,
      question: row.question,
      createdAt: row.created_at,
    }))
}

function normalizeDefaultUserAccounts() {
  const obsoleteSeedTeacher = /^teacher(?:[7-9]|[12]\d|30)@stjoseph\.co\.ls$/i
  const retainedUsers = users.filter(
    (user) => !obsoleteSeedTeacher.test(user.username),
  )
  const repairedUsers = retainedUsers.map((user) => {
    const match = defaultUsers.find(
      (seed) =>
        seed.username.toLowerCase() ===
        String(user.username || "").toLowerCase(),
    )
    return match
      ? {
          ...user,
          username: match.username,
          password: match.password,
          role: match.role,
          name: match.name,
          email: match.email || match.username,
        }
      : user
  })

  for (const seedUser of defaultUsers) {
    const found = repairedUsers.some(
      (user) => user.username.toLowerCase() === seedUser.username.toLowerCase(),
    )
    const countForRole = repairedUsers.filter(
      (user) => user.role === seedUser.role,
    ).length
    if (!found && countForRole < ROLE_LIMITS[seedUser.role]) {
      const nextId =
        repairedUsers.reduce((max, user) => Math.max(max, user.id), 0) + 1
      repairedUsers.push({
        ...seedUser,
        id: nextId,
        email: seedUser.email || seedUser.username,
      })
    }
  }

  users = repairedUsers
  syncToDatabase()
}

function syncToDatabase() {
  const seenUserIds = new Map()
  for (const user of users) {
    if (seenUserIds.has(user.id)) {
      throw new Error(
        `Duplicate user ID ${user.id} for ${seenUserIds.get(user.id)} and ${user.username} while synchronizing the database.`,
      )
    }
    seenUserIds.set(user.id, user.username)
  }

  db.exec("BEGIN")
  try {
    db.exec("DELETE FROM users")
    const insertUser = db.prepare(
      "INSERT INTO users (id, username, password, role, name, email) VALUES (?, ?, ?, ?, ?, ?)",
    )
    for (const user of users) {
      insertUser.run(
        user.id,
        user.username,
        user.password,
        user.role,
        user.name,
        user.email || user.username,
      )
    }

    db.exec("DELETE FROM materials")
    const insertMaterial = db.prepare(
      "INSERT INTO materials (id, title, type, url, uploaded_by, size) VALUES (?, ?, ?, ?, ?, ?)",
    )
    for (const material of materials) {
      insertMaterial.run(
        material.id,
        material.title,
        material.type,
        material.url,
        material.uploadedBy,
        material.size,
      )
    }

    db.exec("DELETE FROM learning_sessions")
    db.prepare(
      "INSERT INTO learning_sessions (id, active, start_time, end_time) VALUES (1, ?, ?, ?)",
    ).run(
      Number(learningSessions.active),
      learningSessions.startTime,
      learningSessions.endTime,
    )

    db.exec("DELETE FROM audit_logs")
    const insertAuditLog = db.prepare(
      "INSERT INTO audit_logs (timestamp, user_name, action) VALUES (?, ?, ?)",
    )
    for (const log of auditLogs) {
      insertAuditLog.run(log.timestamp, log.user, log.action)
    }

    db.exec("DELETE FROM discussions")
    const insertDiscussion = db.prepare(
      "INSERT INTO discussions (id, user_name, user_role, user_email, question, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    for (const item of discussionPosts) {
      insertDiscussion.run(
        item.id,
        item.userName,
        item.userRole,
        item.userEmail,
        item.question,
        item.createdAt,
      )
    }
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

const userColumns = db.prepare("PRAGMA table_info(users)").all()
if (!userColumns.some((column) => column.name === "email")) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT")
}

function seedDatabaseIfEmpty() {
  const userCount = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get().count
  if (userCount > 0) return

  const insertUser = db.prepare(
    "INSERT INTO users (id, username, password, role, name, email) VALUES (?, ?, ?, ?, ?, ?)",
  )
  for (const user of defaultUsers) {
    insertUser.run(
      user.id,
      user.username,
      user.password,
      user.role,
      user.name,
      user.email || user.username,
    )
  }

  const insertMaterial = db.prepare(
    "INSERT INTO materials (id, title, type, url, uploaded_by, size) VALUES (?, ?, ?, ?, ?, ?)",
  )
  for (const material of defaultMaterials) {
    insertMaterial.run(
      material.id,
      material.title,
      material.type,
      material.url,
      material.uploadedBy,
      material.size,
    )
  }

  db.prepare(
    "INSERT INTO learning_sessions (id, active, start_time, end_time) VALUES (1, ?, ?, ?)",
  ).run(
    Number(learningSessions.active),
    learningSessions.startTime,
    learningSessions.endTime,
  )

  const insertAuditLog = db.prepare(
    "INSERT INTO audit_logs (timestamp, user_name, action) VALUES (?, ?, ?)",
  )
  for (const log of defaultAuditLogs) {
    insertAuditLog.run(log.timestamp, log.user, log.action)
  }

  const insertDiscussion = db.prepare(
    "INSERT INTO discussions (id, user_name, user_role, user_email, question, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
  insertDiscussion.run(
    1,
    "Mr. Tiisetso",
    "teacher",
    "teacher1@stjoseph.co.ls",
    "What are the key steps in solving motion problems in physics?",
    new Date().toISOString(),
  )
}

seedDatabaseIfEmpty()
syncFromDatabase()
normalizeDefaultUserAccounts()

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader)
    return res.status(401).json({ error: "Access token missing" })

  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired session token" })
  }
}

// Role Check Middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Unauthorized role permission" })
    }
    next()
  }
}

// Session Governance Middleware for Students
const enforceSchoolHours = (req, res, next) => {
  if (req.user.role === "student") {
    if (!learningSessions.active) {
      return res.status(403).json({
        error:
          "Learning platform access is currently restricted by school administration policy.",
      })
    }

    const currentTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Maseru",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
    const withinSession =
      learningSessions.startTime < learningSessions.endTime
        ? currentTime >= learningSessions.startTime &&
          currentTime < learningSessions.endTime
        : currentTime >= learningSessions.startTime ||
          currentTime < learningSessions.endTime

    if (!withinSession) {
      return res.status(403).json({
        error: `Student access is available from ${learningSessions.startTime} to ${learningSessions.endTime} Lesotho time.`,
      })
    }
  }
  next()
}

// --- API ENDPOINTS ---

// 1. Authentication
app.post("/api/login", (req, res) => {
  const { username, password } = req.body
  const normalizedUsername = String(username || "").trim()
  const user = users.find((u) => {
    const candidateValues = [u.username, u.email]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
    return (
      candidateValues.includes(normalizedUsername.toLowerCase()) &&
      u.password === password
    )
  })

  if (!user)
    return res.status(401).json({ error: "Invalid username or password" })

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email || user.username,
    },
    JWT_SECRET,
    { expiresIn: "8h" },
  )

  auditLogs.push({
    timestamp: new Date().toISOString(),
    user: user.username,
    action: "User logged in",
  })
  syncToDatabase()
  res.json({
    token,
    role: user.role,
    name: user.name,
    username: user.username,
    email: user.email || user.username,
  })
})

app.get(
  "/api/admin/users",
  authenticate,
  authorize(["administrator"]),
  (req, res) => {
    res.json(
      users.map(({ id, username, role, name, email }) => ({
        id,
        username,
        role,
        name,
        email,
      })),
    )
  },
)

app.get("/api/class-participants", authenticate, (req, res) => {
  const participantList = users
    .filter(
      (user) =>
        user.role !== "administrator" || req.user.role === "administrator",
    )
    .map(({ id, username, role, name, email }) => ({
      id,
      username,
      role,
      name,
      email: email || username,
    }))

  res.json(participantList)
})

app.post(
  "/api/admin/register-user",
  authenticate,
  authorize(["administrator"]),
  (req, res) => {
    const { fullName, role } = req.body || {}
    const trimmedName = String(fullName || "").trim()
    const userRole = String(role || "")
      .trim()
      .toLowerCase()

    if (!trimmedName || !userRole) {
      return res.status(400).json({ error: "Full name and role are required." })
    }

    if (!["student", "teacher", "administrator"].includes(userRole)) {
      return res
        .status(400)
        .json({ error: "Role must be student, teacher, or administrator." })
    }

    const generatedCredentials = generateAutoCredentials(trimmedName, userRole)

    if (
      users.some(
        (u) =>
          (u.username || "").toLowerCase() ===
            generatedCredentials.username.toLowerCase() ||
          (u.email || "").toLowerCase() ===
            generatedCredentials.email.toLowerCase(),
      )
    ) {
      return res
        .status(409)
        .json({ error: "A user with this generated identity already exists." })
    }

    const currentCounts = getRoleCounts()
    if (
      userRole === "administrator" &&
      currentCounts.administrator >= ROLE_LIMITS.administrator
    ) {
      return res
        .status(400)
        .json({ error: "The system supports only 2 administrators." })
    }

    if (
      userRole === "teacher" &&
      currentCounts.teacher >= ROLE_LIMITS.teacher
    ) {
      return res.status(400).json({
        error: `The system supports up to ${ROLE_LIMITS.teacher} teachers.`,
      })
    }

    if (
      userRole === "student" &&
      currentCounts.student >= ROLE_LIMITS.student
    ) {
      return res.status(400).json({
        error: `The system supports up to ${ROLE_LIMITS.student} students.`,
      })
    }

    const newUser = {
      id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      username: generatedCredentials.username,
      password: generatedCredentials.password,
      role: userRole,
      name: trimmedName,
      email: generatedCredentials.email,
    }

    users.push(newUser)
    auditLogs.push({
      timestamp: new Date().toISOString(),
      user: req.user.username,
      action: `Registered ${userRole}: ${newUser.name} (${newUser.email})`,
    })
    syncToDatabase()

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
      },
    })
  },
)

// 2. Fetch Materials (All Roles - Enforced for Students)
app.get("/api/materials", authenticate, enforceSchoolHours, (req, res) => {
  res.json(materials)
})

app.get("/api/discussions", authenticate, (req, res) => {
  res.json(discussionPosts)
})

app.post(
  "/api/discussions",
  authenticate,
  authorize(["teacher"]),
  (req, res) => {
    const question = String(req.body.question || "").trim()
    if (!question) {
      return res.status(400).json({ error: "Discussion question is required." })
    }

    const post = {
      id: discussionPosts.length
        ? Math.max(...discussionPosts.map((item) => item.id)) + 1
        : 1,
      userName: req.user.name,
      userRole: req.user.role,
      userEmail: req.user.email || req.user.username,
      question,
      createdAt: new Date().toISOString(),
    }

    discussionPosts.unshift(post)
    auditLogs.push({
      timestamp: new Date().toISOString(),
      user: req.user.username,
      action: `Posted discussion: ${question.substring(0, 80)}`,
    })
    syncToDatabase()
    res.status(201).json(post)
  },
)

// 3. Teacher Video/Resource Upload (Up to 400MB)
app.post(
  "/api/upload",
  authenticate,
  authorize(["teacher"]),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" })

    const newMaterial = {
      id: materials.length ? Math.max(...materials.map((m) => m.id)) + 1 : 1,
      title: req.body.title || req.file.originalname,
      type: req.file.mimetype.startsWith("video/") ? "video" : "document",
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.name,
      size: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`,
    }

    materials.push(newMaterial)
    auditLogs.push({
      timestamp: new Date().toISOString(),
      user: req.user.username,
      action: `Uploaded ${newMaterial.type}: ${newMaterial.title} (${newMaterial.size})`,
    })
    syncToDatabase()

    res.json({
      message: "Resource successfully published",
      resource: newMaterial,
    })
  },
)

// 4. Admin Governance: Session Controls
app.get(
  "/api/admin/session",
  authenticate,
  authorize(["administrator"]),
  (req, res) => {
    res.json({ learningSessions })
  },
)

app.post(
  "/api/admin/session",
  authenticate,
  authorize(["administrator"]),
  (req, res) => {
    const { active, startTime, endTime } = req.body || {}
    if (typeof active !== "boolean") {
      return res
        .status(400)
        .json({ error: "Access status must be true or false." })
    }
    if (
      (startTime !== undefined &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) ||
      (endTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))
    ) {
      return res
        .status(400)
        .json({ error: "Session times must use HH:MM format." })
    }
    const nextStartTime = startTime ?? learningSessions.startTime
    const nextEndTime = endTime ?? learningSessions.endTime
    if (nextStartTime === nextEndTime) {
      return res
        .status(400)
        .json({ error: "Session start and end times must be different." })
    }
    learningSessions.startTime = nextStartTime
    learningSessions.endTime = nextEndTime
    learningSessions.active = active
    auditLogs.push({
      timestamp: new Date().toISOString(),
      user: req.user.username,
      action: `Updated platform access policy: ${
        active ? "Active" : "Restricted"
      } (${learningSessions.startTime}-${learningSessions.endTime})`,
    })
    syncToDatabase()
    res.json({
      message: "Governance policy updated successfully",
      learningSessions,
    })
  },
)

// 5. Admin Governance: Audit Logs
app.get(
  "/api/admin/logs",
  authenticate,
  authorize(["administrator"]),
  (req, res) => {
    res.json(auditLogs)
  },
)

app.listen(PORT, () =>
  console.log(
    `St Joseph High School Portal running on http://localhost:${PORT}`,
  ),
)
