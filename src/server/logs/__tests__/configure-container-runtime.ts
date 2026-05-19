import * as fs from "fs";
import { execSync } from "child_process";

const DOCKER_SOCKET = "/var/run/docker.sock";
const TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
const UNIX_SOCKET_PREFIX = "unix://";

function isSocketAccessible(socketPath: string) {
  try {
    fs.accessSync(socketPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function syncSleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function startPodmanSocket(uid: number) {
  const socketPath = `/run/user/${uid}/podman/podman.sock`;

  try {
    execSync("podman system service --time=120 &", {
      shell: "/bin/sh",
      stdio: "ignore",
      timeout: 5000,
    });

    const deadline = Date.now() + 3000;

    while (Date.now() < deadline) {
      if (isSocketAccessible(socketPath)) {
        return socketPath;
      }
      syncSleep(100);
    }
  } catch {
    // Podman not available
  }

  return null;
}

function getSocketPath(dockerHost: string) {
  if (!dockerHost.startsWith(UNIX_SOCKET_PREFIX)) {
    return null;
  }

  return dockerHost.slice(UNIX_SOCKET_PREFIX.length);
}

function detectContainerRuntime() {
  const dockerHost = process.env["DOCKER_HOST"];

  if (dockerHost) {
    const socketPath = getSocketPath(dockerHost);

    if (socketPath?.includes("/.colima/")) {
      return { type: "colima", socketPath };
    }

    if (socketPath?.includes("/podman/")) {
      return { type: "podman", socketPath };
    }

    return { type: "docker" };
  }

  if (isSocketAccessible(DOCKER_SOCKET)) {
    return { type: "docker" };
  }

  const home = process.env["HOME"] ?? "";
  const colimaSocket = `${home}/.colima/default/docker.sock`;
  if (isSocketAccessible(colimaSocket)) {
    return { type: "colima", socketPath: colimaSocket };
  }

  const uid = process.getuid?.();
  if (uid === undefined) {
    return { type: "docker" };
  }

  const podmanSocket = `/run/user/${uid}/podman/podman.sock`;
  const socket = isSocketAccessible(podmanSocket)
    ? podmanSocket
    : startPodmanSocket(uid);

  if (socket) {
    return { type: "podman", socketPath: socket };
  }

  return { type: "docker" };
}

function configureContainerRuntime() {
  const runtime = detectContainerRuntime();

  if (runtime.type === "docker") {
    return;
  }

  process.env["DOCKER_HOST"] = `${UNIX_SOCKET_PREFIX}${runtime.socketPath}`;

  if (runtime.type === "colima") {
    process.env["TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"] ??=
      TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE;
  }
}

configureContainerRuntime();
