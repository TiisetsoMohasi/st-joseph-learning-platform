import { useEffect, useMemo, useState } from "react"

type Role = "administrator" | "teacher" | "student"

type User = {
  id: number

  username: string

  password: string

  role: Role

  name: string

  email: string
}

type Material = {
  id: number

  title: string

  type: "video" | "document"

  url: string

  uploadedBy: string

  size: string
}

type DiscussionPost = {
  id: number

  userName: string

  userRole: string

  userEmail: string

  question: string

  createdAt: string
}

type AuditEntry = {
  timestamp: string

  user: string

  action: string
}

const apiHeaders = (token?: string) => ({
  "Content-Type": "application/json",

  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("sjhs-token"),
  )

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("sjhs-user")

    return savedUser ? JSON.parse(savedUser) as User : null
  })

  const [activeTab, setActiveTab] = useState("overview")

  const [loginRole, setLoginRole] = useState<Role>("teacher")

  const [materials, setMaterials] = useState<Material[]>([])

  const [discussionPosts, setDiscussionPosts] = useState<DiscussionPost[]>([])

  const [participants, setParticipants] = useState<User[]>([])

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])

  const [schoolHours, setSchoolHours] = useState({
    active: true,
    startTime: "08:00",
    endTime: "16:00",
  })

  const [loginForm, setLoginForm] = useState({
    username: "teacher1@stjoseph.co.ls",
    password: "",
  })

  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    role: "student" as Role,
  })

  const [status, setStatus] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const [discussionQuestion, setDiscussionQuestion] = useState("")

  const [registerStatus, setRegisterStatus] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const [resourceTitle, setResourceTitle] = useState("")

  const [resourceFile, setResourceFile] = useState<File | null>(null)

  const [uploadProgress, setUploadProgress] = useState(0)

  const [loading, setLoading] = useState(false)

  const isLoggedIn = Boolean(token && currentUser)

  const roleBadgeColor = useMemo(() => {
    switch (currentUser?.role) {
      case "administrator":
        return "bg-amber-100 text-amber-800"

      case "teacher":
        return "bg-blue-100 text-blue-800"

      default:
        return "bg-emerald-100 text-emerald-800"
    }
  }, [currentUser])

  useEffect(() => {
    if (!token) return

    void loadMaterials()

    void loadParticipants()

    if (currentUser?.role === "teacher") {
      void loadDiscussions()
    }

    if (currentUser?.role === "administrator") {
      void loadAuditLogs()

      void loadGovernance()
    }
  }, [token, currentUser?.role])

  async function login(username: string, password: string) {
    setLoading(true)

    setStatus(null)

    try {
      const response = await fetch("/api/login", {
        method: "POST",

        headers: apiHeaders(),

        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Login failed.")

      const user = {
        id: data.id ?? 0,

        username: data.username,

        password: "",

        role: data.role,

        name: data.name,

        email: data.email,
      } as User

      localStorage.setItem("sjhs-token", data.token)

      localStorage.setItem("sjhs-user", JSON.stringify(user))

      setToken(data.token)

      setCurrentUser(user)

      setStatus({ type: "success", text: `Welcome back, ${data.name}.` })
    } catch (error) {
      setStatus({ type: "error", text: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem("sjhs-token")

    localStorage.removeItem("sjhs-user")

    setToken(null)

    setCurrentUser(null)

    setMaterials([])

    setParticipants([])

    setDiscussionPosts([])

    setAuditLogs([])

    setStatus({ type: "success", text: "You have been logged out." })
  }

  async function loadMaterials() {
    if (!token) return

    const response = await fetch("/api/materials", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok) setMaterials(data)
  }

  async function loadParticipants() {
    if (!token) return

    const response = await fetch("/api/class-participants", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok) setParticipants(data)
  }

  async function loadDiscussions() {
    if (!token) return

    const response = await fetch("/api/discussions", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok) setDiscussionPosts(data)
  }

  async function loadAuditLogs() {
    if (!token || currentUser?.role !== "administrator") return

    const response = await fetch("/api/admin/logs", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok) setAuditLogs(data)
  }

  async function loadGovernance() {
    if (!token || currentUser?.role !== "administrator") return

    const response = await fetch("/api/admin/session", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (response.ok) setSchoolHours(data.learningSessions)
  }

  async function saveGovernance() {
    if (!token) return

    const response = await fetch("/api/admin/session", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(schoolHours),
    })

    const data = await response.json()

    if (response.ok) setSchoolHours(data.learningSessions)
    else
      setStatus({
        type: "error",
        text: data.error || "Could not update the access policy.",
      })
  }

  async function submitDiscussion() {
    if (!token || !discussionQuestion.trim()) return

    const response = await fetch("/api/discussions", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({ question: discussionQuestion }),
    })

    const data = await response.json()

    if (response.ok) {
      setDiscussionQuestion("")

      void loadDiscussions()
    } else {
      setStatus({
        type: "error",
        text: data.error || "Could not post question.",
      })
    }
  }

  async function registerUser(event: React.FormEvent) {
    event.preventDefault()

    if (!token) return

    const response = await fetch("/api/admin/register-user", {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(registerForm),
    })

    const data = await response.json()

    if (!response.ok) {
      setRegisterStatus({
        type: "error",
        text: data.error || "Registration failed.",
      })

      return
    }

    setRegisterStatus({
      type: "success",
      text: `${data.user.name} registered as ${data.user.role}.`,
    })

    setRegisterForm({ fullName: "", role: "student" })

    void loadParticipants()

    void loadAuditLogs()
  }

  function uploadMaterial(event: React.FormEvent) {
    event.preventDefault()

    if (!token || !resourceFile) return

    const formData = new FormData()

    formData.append("file", resourceFile)

    formData.append("title", resourceTitle || resourceFile.name)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setResourceTitle("")

        setResourceFile(null)

        setUploadProgress(0)

        void loadMaterials()
      } else {
        const data = JSON.parse(xhr.responseText || "{}")

        setStatus({ type: "error", text: data.error || "Upload failed." })
      }
    }

    xhr.open("POST", "/api/upload")

    xhr.setRequestHeader("Authorization", `Bearer ${token}`)

    xhr.send(formData)
  }

  const hasAdminAccess = currentUser?.role === "administrator"

  const hasTeacherAccess = currentUser?.role === "teacher" || hasAdminAccess

  const sampleLimits: Record<Role, number> = {
    student: 40,
    teacher: 6,
    administrator: 2,
  }
  const selectedRoleCount = participants.filter(
    (person) => person.role === registerForm.role,
  ).length
  const selectedRoleAtCapacity =
    selectedRoleCount >= sampleLimits[registerForm.role]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-[#003399] text-white shadow-lg sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00C4FF] text-sm font-black text-[#001A4D] shadow-md">
              SJHS
            </div>
            <div>
              <h1 className="text-base font-bold uppercase tracking-tight sm:text-xl">
                St. Joseph High School
              </h1>
              <p className="hidden text-xs text-[#00C4FF] sm:block">
                Controlled Smartphone Usage Mobile Platform
              </p>
            </div>
          </div>

          <div className="hidden border-l border-blue-800 pl-4 text-right text-xs lg:block">
            <p>
              <span className="mr-1 text-[#FF8C00]">☎</span> (+266) 2231 2672 /
              2232 2672
            </p>
            <p>
              <span className="mr-1 text-[#FF8C00]">✉</span>{" "}
              stjosephh22@gmail.com
            </p>
          </div>

          {!isLoggedIn && (
            <button
              type="button"
              onClick={() => {
                setLoginRole("administrator")

                setLoginForm({ username: "admin1", password: "" })

                setStatus(null)
              }}
              className="rounded-lg bg-[#FF8C00] px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-orange-600"
            >
              Admin sign in
            </button>
          )}
          {isLoggedIn && (
            <div className="text-right">
              <p className="text-xs font-semibold">{currentUser?.name}</p>
              <p className="text-[10px] uppercase text-blue-200">
                {currentUser?.role}
              </p>
            </div>
          )}
        </div>
      </header>

      {!isLoggedIn ? (
        <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl flex-col justify-center px-4 py-8 sm:px-8">
          <div className="mb-8 grid overflow-hidden rounded-3xl bg-gradient-to-br from-[#003399] via-[#002773] to-[#001A4D] text-white shadow-xl md:grid-cols-[1.5fr_1fr]">
            <div className="p-6 sm:p-9">
              <span className="inline-flex rounded-full bg-[#00C4FF] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#001A4D]">
                Official E-Learning Portal
              </span>
              <h2 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
                Learning without limits.
                <br />
                Access with purpose.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100">
                A secure, school-approved space for lessons, teaching resources,
                and class collaboration at St. Joseph High School.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  🔒 School-managed access
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  📚 Shared learning resources
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-white/10 bg-white/5 p-5 md:grid-cols-1 md:content-center md:border-l md:border-t-0 md:p-8">
              <div className="rounded-2xl bg-white/10 p-3 text-center md:flex md:items-center md:justify-between md:p-4 md:text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-blue-100 md:text-xs">
                  Students
                </span>
                <strong className="mt-1 block text-2xl font-black sm:text-3xl">
                  40
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center md:flex md:items-center md:justify-between md:p-4 md:text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-blue-100 md:text-xs">
                  Teachers
                </span>
                <strong className="mt-1 block text-2xl font-black sm:text-3xl">
                  6
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center md:flex md:items-center md:justify-between md:p-4 md:text-left">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-blue-100 md:text-xs">
                  Administrators
                </span>
                <strong className="mt-1 block text-2xl font-black sm:text-3xl">
                  2
                </strong>
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF8C00]">
                Welcome to SJHS
              </p>
              <h3 className="mt-1 text-xl font-bold text-[#003399]">
                Choose your portal
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Sign in with your school account
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              aria-pressed={loginRole === "teacher"}
              onClick={() => {
                setLoginRole("teacher")

                setLoginForm({
                  username: "teacher1@stjoseph.co.ls",
                  password: "",
                })

                setStatus(null)
              }}
              className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                loginRole === "teacher"
                  ? "border-[#003399] ring-2 ring-blue-100"
                  : "border-slate-200"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl text-[#003399]">
                🎓
              </span>
              <span className="mt-4 block text-lg font-bold text-slate-900">
                Teacher portal
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Publish lessons, share class materials, and collaborate with
                students.
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#003399]">
                Continue as teacher <span aria-hidden="true">→</span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={loginRole === "student"}
              onClick={() => {
                setLoginRole("student")

                setLoginForm({
                  username: "student1@stjoseph.com",
                  password: "",
                })

                setStatus(null)
              }}
              className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                loginRole === "student"
                  ? "border-[#00A8D7] ring-2 ring-cyan-100"
                  : "border-slate-200"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-2xl text-[#007FA8]">
                📖
              </span>
              <span className="mt-4 block text-lg font-bold text-slate-900">
                Student portal
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Find class resources and stay connected to school-approved
                learning.
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#007FA8]">
                Continue as student <span aria-hidden="true">→</span>
              </span>
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void login(loginForm.username, loginForm.password)
            }}
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Secure sign in
                </p>
                <h4 className="mt-1 text-lg font-bold text-[#003399]">
                  Sign in to your{" "}
                  {loginRole === "administrator" ? "admin" : loginRole} account
                </h4>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                  loginRole === "teacher"
                    ? "bg-blue-50 text-[#003399]"
                    : loginRole === "student"
                      ? "bg-cyan-50 text-[#007FA8]"
                      : "bg-orange-50 text-orange-700"
                }`}
              >
                {loginRole}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="text-xs font-semibold text-slate-600">
                Username or school email
                <input
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-blue-100"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-blue-100"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button
                disabled={loading}
                type="submit"
                className="rounded-lg bg-[#003399] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#001A4D] disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
            {status && (
              <div
                role="status"
                className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                  status.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {status.text}
              </div>
            )}
          </form>
          <p className="mt-5 text-center text-xs text-slate-500">
            Need help accessing your account? Contact the school administrator.
          </p>
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
          <aside className="w-full bg-[#001A4D] p-5 text-white md:min-h-[calc(100vh-64px)] md:w-64">
            <div className="mb-6 flex items-center gap-3 border-b border-blue-900 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C4FF] text-xs font-black text-[#001A4D]">
                SJHS
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold">
                  {currentUser?.name}
                </h4>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeColor}`}
                >
                  {currentUser?.role}
                </span>
              </div>
            </div>

            <nav
              aria-label="Main navigation"
              className="grid grid-cols-2 gap-1.5 text-sm md:block md:space-y-1.5"
            >
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                  activeTab === "overview"
                    ? "bg-blue-900 text-white"
                    : "text-blue-200 hover:bg-blue-900 hover:text-white"
                } transition`}
              >
                <span>⌂</span>
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resources")}
                className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                  activeTab === "resources"
                    ? "bg-blue-900 text-white"
                    : "text-blue-200 hover:bg-blue-900 hover:text-white"
                } transition`}
              >
                <span>📚</span>
                Learning Resources
              </button>
              {(currentUser?.role === "teacher" ||
                currentUser?.role === "administrator") && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "upload"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>📤</span>
                    Upload Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("forum")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "forum"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>💬</span>
                    Discussion Forum
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("participants")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "participants"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>👥</span>
                    Participants
                  </button>
                </>
              )}
              {hasAdminAccess && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("governance")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "governance"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>⚙️</span>
                    Policy Governance
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("audit")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "audit"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>🧾</span>
                    Audit Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("register")}
                    className={`flex w-full items-center gap-3 rounded-lg p-2.5 ${
                      activeTab === "register"
                        ? "bg-blue-900 text-white"
                        : "text-blue-200 hover:bg-blue-900 hover:text-white"
                    } transition`}
                  >
                    <span>➕</span>
                    Register User
                  </button>
                </>
              )}
            </nav>

            <button
              type="button"
              onClick={logout}
              className="mt-6 w-full rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-600"
            >
              Sign out
            </button>
          </aside>

          <main className="min-w-0 flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF8C00]">
                  St. Joseph High School
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#003399]">
                  {activeTab === "overview"
                    ? `Good day, ${currentUser?.name?.split(" ")[0] ?? "there"}`
                    : activeTab === "resources"
                      ? "Learning Resources"
                      : activeTab === "upload"
                        ? "Publish a Resource"
                        : activeTab === "forum"
                          ? "Discussion Forum"
                          : activeTab === "participants"
                            ? "Class Participants"
                            : activeTab === "governance"
                              ? "Policy Governance"
                              : activeTab === "audit"
                                ? "Audit Logs"
                                : "Register a User"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeTab === "overview"
                    ? "Here’s what’s happening across your learning portal."
                    : "Manage your school learning workspace."}
                </p>
              </div>
              <div
                className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  schoolHours.active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    schoolHours.active ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                {schoolHours.active
                  ? "Learning access active"
                  : "Learning access restricted"}
              </div>
            </div>
            {status && (
              <div
                role="status"
                className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                  status.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {status.text}
              </div>
            )}

            {activeTab === "overview" && (
              <div className="space-y-6">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Study cohort
                    </p>
                    <p className="mt-3 text-3xl font-black text-[#003399]">
                      48
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Accounts in the school sample
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Students
                    </p>
                    <p className="mt-3 text-3xl font-black text-[#007FA8]">
                      40
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Learners in the sample
                    </p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Teachers
                    </p>
                    <p className="mt-3 text-3xl font-black text-indigo-700">
                      6
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Teaching staff in the sample
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Administrators
                    </p>
                    <p className="mt-3 text-3xl font-black text-orange-700">
                      2
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      School system managers
                    </p>
                  </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-2xl bg-gradient-to-br from-[#003399] to-[#001A4D] p-6 text-white shadow-sm sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                      Your learning space
                    </p>
                    <h3 className="mt-2 max-w-lg text-2xl font-extrabold">
                      Build knowledge together, one lesson at a time.
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">
                      Browse the latest resources, pick up a class discussion,
                      or explore the school cohort.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("resources")}
                      className="mt-5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#003399] transition hover:bg-cyan-50"
                    >
                      Explore learning resources{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Portal snapshot
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          Today at SJHS
                        </h3>
                      </div>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">
                        ✨
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                        <span className="text-sm text-slate-600">
                          Published resources
                        </span>
                        <span className="text-sm font-bold text-[#003399]">
                          {materials.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                        <span className="text-sm text-slate-600">
                          Learning schedule
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          {schoolHours.startTime}–{schoolHours.endTime}
                        </span>
                      </div>
                      {hasTeacherAccess && (
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                          <span className="text-sm text-slate-600">
                            Class participants
                          </span>
                          <span className="text-sm font-bold text-slate-800">
                            {participants.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "resources" && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {materials.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No learning resources available yet.
                  </p>
                ) : (
                  materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex min-h-[220px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              material.type === "video"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-[#003399]"
                            }`}
                          >
                            {material.type}
                          </span>
                          <span className="text-xs text-slate-400">
                            {material.size}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {material.title}
                        </h4>
                        <p className="mt-2 text-xs text-slate-500">
                          Publisher: {material.uploadedBy}
                        </p>
                      </div>
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 block rounded-lg bg-[#003399] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#001A4D]"
                      >
                        Access File
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "upload" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <form onSubmit={uploadMaterial} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Resource title
                    </label>
                    <input
                      value={resourceTitle}
                      onChange={(e) => setResourceTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Algebra revision notes"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Select file
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        setResourceFile(e.target.files?.[0] ?? null)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {uploadProgress > 0 && (
                    <div className="rounded-lg bg-slate-100 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Uploading</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200">
                        <div
                          className="h-2.5 rounded-full bg-[#00C4FF]"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!resourceFile}
                    className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#001A4D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publish Resource
                  </button>
                </form>
              </div>
            )}

            {activeTab === "forum" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <textarea
                    value={discussionQuestion}
                    onChange={(e) => setDiscussionQuestion(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ask a question for the class discussion forum..."
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submitDiscussion()}
                      className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white hover:bg-[#001A4D]"
                    >
                      Post Question
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {discussionPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#003399]">
                            {post.userName}
                          </span>
                          <span className="ml-2 text-[10px] uppercase text-slate-500">
                            {post.userRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(post.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{post.question}</p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Email: {post.userEmail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "participants" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {participants.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between border-b border-slate-200 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {person.name}
                      </p>
                      <p className="text-[10px] uppercase text-slate-500">
                        {person.role}
                      </p>
                    </div>
                    <div className="text-right text-xs text-[#003399]">
                      {person.email}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "governance" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#003399]">
                      School Access Policy
                    </h3>
                    <p className="text-xs text-slate-500">
                      Student access follows this schedule in Lesotho local
                      time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveGovernance()}
                    className="rounded-lg bg-[#003399] px-3 py-2 text-xs font-semibold text-white hover:bg-[#001A4D]"
                  >
                    Apply Policy
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Start time
                    <input
                      type="time"
                      value={schoolHours.startTime}
                      onChange={(e) =>
                        setSchoolHours({
                          ...schoolHours,
                          startTime: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    End time
                    <input
                      type="time"
                      value={schoolHours.endTime}
                      onChange={(e) =>
                        setSchoolHours({
                          ...schoolHours,
                          endTime: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-100 p-3">
                  <span className="text-sm font-medium text-slate-700">
                    System access status
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSchoolHours({
                        ...schoolHours,
                        active: !schoolHours.active,
                      })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      schoolHours.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {schoolHours.active ? "Active" : "Restricted"}
                  </button>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <p className="text-xs uppercase text-slate-500">Admins</p>
                    <p className="mt-2 text-2xl font-black text-[#003399]">
                      {
                        participants.filter((u) => u.role === "administrator")
                          .length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl bg-cyan-50 p-4 text-center">
                    <p className="text-xs uppercase text-slate-500">Teachers</p>
                    <p className="mt-2 text-2xl font-black text-[#00C4FF]">
                      {participants.filter((u) => u.role === "teacher").length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4 text-center">
                    <p className="text-xs uppercase text-slate-500">Students</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">
                      {participants.filter((u) => u.role === "student").length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#003399]">
                    Security Audit Trail
                  </h3>
                  <span className="text-xs text-slate-500">
                    {auditLogs.length} entries
                  </span>
                </div>
                <div className="space-y-2">
                  {auditLogs.map((log, index) => (
                    <div
                      key={`${log.user}-${index}`}
                      className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                    >
                      <span className="font-semibold">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{" "}
                      {log.user}: {log.action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "register" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#003399]">
                    Study cohort capacity
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    40 students · 6 teachers · 2 administrators
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Full roles are locked to keep the sample size consistent.
                  </p>
                </div>
                <form onSubmit={registerUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Full name
                    </label>
                    <input
                      value={registerForm.fullName}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          fullName: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Jane Mokoena"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Role
                    </label>
                    <select
                      value={registerForm.role}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          role: e.target.value as Role,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option
                        value="student"
                        disabled={
                          participants.filter((user) => user.role === "student")
                            .length >= 40
                        }
                      >
                        Student —{" "}
                        {
                          participants.filter((user) => user.role === "student")
                            .length
                        }
                        /40
                      </option>
                      <option
                        value="teacher"
                        disabled={
                          participants.filter((user) => user.role === "teacher")
                            .length >= 6
                        }
                      >
                        Teacher —{" "}
                        {
                          participants.filter((user) => user.role === "teacher")
                            .length
                        }
                        /6
                      </option>
                      <option
                        value="administrator"
                        disabled={
                          participants.filter(
                            (user) => user.role === "administrator",
                          ).length >= 2
                        }
                      >
                        Administrator —{" "}
                        {
                          participants.filter(
                            (user) => user.role === "administrator",
                          ).length
                        }
                        /2
                      </option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={selectedRoleAtCapacity}
                    className="rounded-lg bg-[#003399] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#001A4D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedRoleAtCapacity
                      ? `Sample full (${selectedRoleCount}/${sampleLimits[registerForm.role]})`
                      : "Register User"}
                  </button>
                  {registerStatus && (
                    <div
                      role="status"
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        registerStatus.type === "error"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-green-200 bg-green-50 text-green-700"
                      }`}
                    >
                      {registerStatus.text}
                    </div>
                  )}
                </form>
              </div>
            )}
          </main>
        </div>
      )}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        <p>© 2026 St. Joseph High School · Maseru, Lesotho</p>
        <p className="mt-1">
          School-approved learning access for students, teachers, and
          administrators.
        </p>
      </footer>
    </div>
  )
}

export default App
