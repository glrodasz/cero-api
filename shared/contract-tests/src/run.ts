import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Usage (from the repository root):
//   yarn contract typescript-express            # boots the app, runs the suite, stops the app
//   STORAGE=memory yarn contract go-gin         # environment variables reach the app
//   yarn contract --list
//
// To test a server that is already running, skip the runner:
//   API_URL=http://127.0.0.1:8080 yarn workspace @cero/contract-tests suite

type App = {
  /** Folder of the implementation, relative to the repository root. */
  cwd: string;
  /** Shell command that starts the server in the foreground. */
  start: string;
  /** Base URL (REST) or endpoint (GraphQL) the server listens on. */
  url: string;
  protocol?: "rest" | "graphql";
  env?: Record<string, string>;
  /**
   * Path (appended to `url`) that must answer 2xx before the suite starts.
   * Needed by platforms that accept connections before the API is loaded,
   * like the Firebase emulator. Without it, any HTTP answer means "ready".
   */
  ready?: string;
  /** Tests the platform cannot pass, by exact name, with the reason. Skipped and reported. */
  knownFailures?: Record<string, string>;
};

const STARTUP_TIMEOUT_MS = 300_000;

const contractTestsDir = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const apps: Record<string, App> = JSON.parse(readFileSync(new URL("../apps.json", import.meta.url), "utf8"));

const appName = process.argv[2];
if (appName === undefined || appName === "--list" || !(appName in apps)) {
  console.log(`Implementations: ${Object.keys(apps).join(", ")}`);
  process.exit(appName === "--list" ? 0 : 1);
}

const app = apps[appName]!;
const serverOutput: string[] = [];
const server = spawn(app.start, {
  cwd: `${repositoryRoot}/${app.cwd}`,
  shell: true,
  detached: true, // own process group, so stopping it also stops whatever it spawned
  env: { ...process.env, ...app.env },
  stdio: ["ignore", "pipe", "pipe"],
});
// Keep draining the server's output: a full pipe would block a server that logs every request.
server.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
server.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));

const stopServer = () => {
  try {
    process.kill(-server.pid!, "SIGTERM");
  } catch {
    // already gone
  }
};

const isReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${app.url}${app.ready ?? ""}`, { signal: AbortSignal.timeout(2_000) });
    return app.ready === undefined || response.ok;
  } catch {
    return false;
  }
};

const waitUntilReady = async () => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`${appName} exited with code ${server.exitCode}`);
    if (await isReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${appName} was not ready on ${app.url} within ${STARTUP_TIMEOUT_MS / 1000}s`);
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Runs the suite in a child process, asynchronously so the server's output keeps flowing. */
const runSuite = () =>
  new Promise<number>((resolve) => {
    const knownFailures = Object.keys(app.knownFailures ?? {});
    const skipFlags = knownFailures.map((name) => `--test-skip-pattern=^${escapeRegExp(name)}$`);

    const tests = spawn(process.execPath, ["--test", "--test-concurrency=1", ...skipFlags, "src/**/*.test.ts"], {
      cwd: contractTestsDir,
      env: { ...process.env, API_URL: app.url, API_PROTOCOL: app.protocol ?? "rest" },
      stdio: "inherit",
    });
    tests.on("exit", (code) => resolve(code ?? 1));
  });

try {
  console.log(`Starting ${appName}: ${app.start}`);
  await waitUntilReady();

  const status = await runSuite();

  for (const [name, reason] of Object.entries(app.knownFailures ?? {})) {
    console.log(`# known failure, skipped: "${name}" (${reason})`);
  }
  if (status !== 0) {
    console.error(`\n--- ${appName} output ---\n${serverOutput.join("")}`);
  }
  stopServer();
  process.exit(status);
} catch (error) {
  console.error(`\n--- ${appName} output ---\n${serverOutput.join("")}`);
  console.error(error);
  stopServer();
  process.exit(1);
}
