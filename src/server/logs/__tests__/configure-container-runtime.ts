import * as fs from "fs";
import { execSync } from "child_process";

function isSocketAccessible(socketPath: string): boolean {
  try {
    fs.accessSync(socketPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function syncSleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function startPodmanSocket(uid: number): string | null {
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

if (!process.env["DOCKER_HOST"]) {
  const dockerSocket = "/var/run/docker.sock";

  if (!isSocketAccessible(dockerSocket)) {
    const uid = process.getuid?.();

    if (uid !== undefined) {
      const podmanSocket = `/run/user/${uid}/podman/podman.sock`;

      const socket = isSocketAccessible(podmanSocket)
        ? podmanSocket
        : startPodmanSocket(uid);

      if (socket) {
        process.env["DOCKER_HOST"] = `unix://${socket}`;
      }
    }
  }
}
