import { spawn, spawnSync } from "node:child_process";
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
};

const STARTUP_TIMEOUT_MS = 180_000;

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
server.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
server.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));

const stopServer = () => {
  try {
    process.kill(-server.pid!, "SIGTERM");
  } catch {
    // already gone
  }
};

const waitUntilListening = async (url: string) => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`${appName} exited with code ${server.exitCode}`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      return; // any HTTP answer means the server is up
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${appName} did not answer on ${url} within ${STARTUP_TIMEOUT_MS / 1000}s`);
};

try {
  console.log(`Starting ${appName}: ${app.start}`);
  await waitUntilListening(app.url);

  const tests = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "src/**/*.test.ts"], {
    cwd: contractTestsDir,
    env: { ...process.env, API_URL: app.url, API_PROTOCOL: app.protocol ?? "rest" },
    stdio: "inherit",
  });

  if (tests.status !== 0) {
    console.error(`\n--- ${appName} output ---\n${serverOutput.join("")}`);
  }
  stopServer();
  process.exit(tests.status ?? 1);
} catch (error) {
  console.error(`\n--- ${appName} output ---\n${serverOutput.join("")}`);
  console.error(error);
  stopServer();
  process.exit(1);
}
