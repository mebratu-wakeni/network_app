import { nativeImage, app, ipcMain, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath as fileURLToPath$1 } from "node:url";
import path$1 from "node:path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
const execAsync = promisify(exec);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
function findProjectRoot(startPath) {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;
  while (current !== root) {
    const dockerComposePath = path.join(current, "docker-compose.yml");
    const apiDir = path.join(current, "api");
    if (existsSync(dockerComposePath) && existsSync(apiDir)) {
      return current;
    }
    current = path.dirname(current);
  }
  const possibleRoots = [
    path.resolve(__dirname$1, "../.."),
    // from dist-electron/ or electron/
    path.resolve(__dirname$1, "../../.."),
    // from electron/services/
    path.resolve(__dirname$1, "../../../..")
    // from services/ (if nested deeper)
  ];
  for (const possibleRoot of possibleRoots) {
    const dockerComposePath = path.join(possibleRoot, "docker-compose.yml");
    if (existsSync(dockerComposePath)) {
      return possibleRoot;
    }
  }
  throw new Error("Could not find project root. Make sure docker-compose.yml exists in the project root.");
}
const ROOT_DIR = findProjectRoot(__dirname$1);
const SERVER_DIR = path.join(ROOT_DIR, "api");
console.log("ROOT_DIR: ", ROOT_DIR);
class ServerManager {
  constructor() {
    this.composeFile = path.join(ROOT_DIR, "docker-compose.yml");
    this.isRunning = false;
    this.devProcess = null;
    this.mode = "docker";
    if (!existsSync(this.composeFile)) {
      console.error(`ERROR: docker-compose.yml not found at: ${this.composeFile}`);
      console.error(`ROOT_DIR resolved to: ${ROOT_DIR}`);
      throw new Error(`docker-compose.yml not found at: ${this.composeFile}`);
    }
    console.log(`✓ docker-compose.yml found at: ${this.composeFile}`);
  }
  /**
   * Start development server (npm run dev)
   */
  async startDevServer() {
    try {
      if (this.devProcess && !this.devProcess.killed) {
        return { success: false, error: "Development server is already running" };
      }
      console.log(`[startDevServer] Starting dev server from: ${SERVER_DIR}`);
      if (!existsSync(SERVER_DIR)) {
        return { success: false, error: `API directory not found at: ${SERVER_DIR}` };
      }
      this.devProcess = spawn("npm", ["run", "dev"], {
        shell: true,
        cwd: SERVER_DIR,
        stdio: ["ignore", "pipe", "pipe"]
      });
      this.devProcess.stdout.on("data", (data) => {
        console.log(`[DEV]: ${data}`);
      });
      this.devProcess.stderr.on("data", (data) => {
        console.error(`[DEV ERROR]: ${data}`);
      });
      this.devProcess.on("close", (code) => {
        console.log(`Development server process exited with code ${code}`);
        this.devProcess = null;
      });
      this.devProcess.on("error", (err) => {
        console.error("Failed to start development server process:", err);
        this.devProcess = null;
        return { success: false, error: err.message };
      });
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      if (this.devProcess && !this.devProcess.killed) {
        this.isRunning = true;
        return { success: true, message: "Development server started successfully" };
      } else {
        return { success: false, error: "Failed to start development server" };
      }
    } catch (error) {
      console.error(`[startDevServer] Error:`, error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Stop development server
   */
  async stopDevServer() {
    try {
      if (!this.devProcess) {
        return { success: false, error: "Development server is not running" };
      }
      console.log(`[stopDevServer] Stopping dev server...`);
      if (!this.devProcess.killed) {
        this.devProcess.kill("SIGTERM");
        setTimeout(() => {
          if (this.devProcess && !this.devProcess.killed) {
            this.devProcess.kill("SIGKILL");
          }
        }, 3e3);
      }
      this.devProcess = null;
      this.isRunning = false;
      return { success: true, message: "Development server stopped successfully" };
    } catch (error) {
      console.error(`[stopDevServer] Error:`, error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Check if dev server is running
   */
  async checkDevServerStatus() {
    try {
      if (this.devProcess && !this.devProcess.killed) {
        return { success: true, running: true };
      }
      const health = await this.checkApiHealth();
      return { success: true, running: health.healthy };
    } catch (error) {
      return { success: false, running: false, error: error.message };
    }
  }
  /**
   * Check if Docker is installed and running
   */
  async checkDocker() {
    try {
      await execAsync("docker --version");
      await execAsync("docker ps");
      return { installed: true, running: true };
    } catch (error) {
      if (error.message.includes("docker: command not found")) {
        return { installed: false, running: false, error: "Docker not installed" };
      }
      return { installed: true, running: false, error: "Docker not running" };
    }
  }
  /**
   * Start Docker services
   */
  async startServices() {
    try {
      console.log(`[startServices] Starting services...`);
      console.log(`[startServices] composeFile: ${this.composeFile}`);
      console.log(`[startServices] ROOT_DIR: ${ROOT_DIR}`);
      const command = `docker compose -f "${this.composeFile}" up -d`;
      console.log(`[startServices] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command, { cwd: ROOT_DIR });
      console.log(`[startServices] stdout:`, stdout);
      if (stderr) {
        console.log(`[startServices] stderr:`, stderr);
      }
      if (stderr && !stderr.includes("Creating") && !stderr.includes("Starting") && !stderr.includes("Started")) {
        const isError = stderr.toLowerCase().includes("error") || stderr.toLowerCase().includes("failed") || stderr.toLowerCase().includes("cannot");
        if (isError) {
          throw new Error(stderr);
        }
      }
      this.isRunning = true;
      return { success: true, message: "Services started successfully", stdout, stderr };
    } catch (error) {
      console.error(`[startServices] Error:`, error);
      this.isRunning = false;
      return { success: false, error: error.message, details: error.toString() };
    }
  }
  /**
   * Stop Docker services
   */
  async stopServices() {
    try {
      console.log(`[stopServices] Stopping services...`);
      console.log(`[stopServices] composeFile: ${this.composeFile}`);
      console.log(`[stopServices] ROOT_DIR: ${ROOT_DIR}`);
      const command = `docker compose -f "${this.composeFile}" down`;
      console.log(`[stopServices] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command, { cwd: ROOT_DIR });
      console.log(`[stopServices] stdout:`, stdout);
      if (stderr) {
        console.log(`[stopServices] stderr:`, stderr);
      }
      this.isRunning = false;
      return { success: true, message: "Services stopped successfully", stdout, stderr };
    } catch (error) {
      console.error(`[stopServices] Error:`, error);
      return { success: false, error: error.message, details: error.toString() };
    }
  }
  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      const command = `docker compose -f "${this.composeFile}" ps --format json`;
      const { stdout } = await execAsync(command, { cwd: ROOT_DIR });
      if (!stdout || !stdout.trim()) {
        return { success: true, services: [] };
      }
      const services = stdout.trim().split("\n").filter((line) => line.trim()).map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.warn(`Failed to parse service line: ${line}`, e);
          return null;
        }
      }).filter((svc) => svc !== null);
      return {
        success: true,
        services: services.map((svc) => ({
          name: svc.Name,
          status: svc.State,
          health: svc.Health || "unknown"
        }))
      };
    } catch (error) {
      console.error(`[getServiceStatus] Error:`, error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Check API health
   */
  async checkApiHealth() {
    try {
      const response = await fetch("http://localhost:4000/health");
      const data = await response.json();
      return { success: true, healthy: data.ok === true };
    } catch (error) {
      return { success: false, healthy: false, error: error.message };
    }
  }
  /**
   * Get service logs
   */
  async getLogs(service = "backend", lines = 100) {
    try {
      const { stdout } = await execAsync(
        `docker compose -f "${this.composeFile}" logs --tail=${lines} ${service}`,
        { cwd: ROOT_DIR }
      );
      return { success: true, logs: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
createRequire(import.meta.url);
const __dirname = path$1.dirname(fileURLToPath$1(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const serverManager = new ServerManager();
const iconPath = path$1.join(__dirname, "..", "public", "masatech-logo.png");
const iconImage = nativeImage.createFromPath(iconPath);
app.dock.setIcon(iconImage);
app.dock.bounce();
function createWindow() {
  win = new BrowserWindow({
    icon: iconPath,
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
  win.maximize();
}
ipcMain.handle("server:check-docker", async () => {
  return await serverManager.checkDocker();
});
ipcMain.handle("server:start", async (event, mode = "docker") => {
  if (mode === "dev") {
    return await serverManager.startDevServer();
  }
  return await serverManager.startServices();
});
ipcMain.handle("server:stop", async (event, mode = "docker") => {
  if (mode === "dev") {
    return await serverManager.stopDevServer();
  }
  return await serverManager.stopServices();
});
ipcMain.handle("server:status", async () => {
  return await serverManager.getServiceStatus();
});
ipcMain.handle("server:health", async () => {
  return await serverManager.checkApiHealth();
});
ipcMain.handle("server:logs", async (event, service, lines) => {
  return await serverManager.getLogs(service, lines);
});
ipcMain.handle("server:check-dev-status", async () => {
  return await serverManager.checkDevServerStatus();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("before-quit", async () => {
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
