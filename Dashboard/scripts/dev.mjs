import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const dashboardDirectory = fileURLToPath(new URL("../", import.meta.url));
const services = ["backend", "frontend"];
const children = services.map((service) =>
  spawn(npmCommand, ["--prefix", service, "run", "dev"], {
    cwd: dashboardDirectory,
    env: process.env,
    stdio: "inherit",
  }),
);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(`Failed to start a development service: ${error.message}`);
    shutdown("SIGTERM");
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      process.exitCode = code ?? (signal ? 1 : 0);
      shutdown("SIGTERM");
    }

    if (children.every((service) => service.exitCode !== null || service.signalCode !== null)) {
      process.exit();
    }
  });
}
