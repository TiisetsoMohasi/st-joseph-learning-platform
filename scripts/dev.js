const net = require("node:net")
const { spawn } = require("node:child_process")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const apiPort = process.env.API_PORT || process.env.PORT || "3000"
const vitePort = process.env.VITE_PORT || "8443"
const children = []
let stopping = false

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: Number(port) })

    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        resolve(false)
      } else {
        reject(error)
      }
    })
  })
}

function startChild(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, API_PORT: apiPort },
    stdio: "inherit",
  })
  children.push(child)

  child.on("error", (error) => {
    console.error("Could not start the development service:", error)
    stop(1)
  })

  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1)
  })
}

function stop(exitCode) {
  if (stopping) return

  stopping = true
  process.exitCode = exitCode
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
}

async function start() {
  if (!(await isPortInUse(apiPort))) {
    startChild(process.execPath, [path.join(root, "server.js")])
  } else {
    console.log(`Using the API server already listening on port ${apiPort}.`)
  }

  if (stopping) return

  startChild(
    process.execPath,
    [
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "0.0.0.0",
      "--port",
      vitePort,
      "--strictPort",
    ],
  )
}

process.on("SIGINT", () => stop(0))
process.on("SIGTERM", () => stop(0))

start().catch((error) => {
  console.error("Could not check the API port:", error)
  stop(1)
})
