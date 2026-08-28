import { execFileSync, spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const action = process.argv[2] ?? "up";

function tailscaleStatus() {
  if (process.env.TAILSCALE_STATUS_JSON) {
    return JSON.parse(process.env.TAILSCALE_STATUS_JSON);
  }
  return JSON.parse(
    execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" })
  );
}

function plan() {
  const status = tailscaleStatus();
  const hostname = status?.Self?.DNSName?.replace(/\.$/, "");
  if (!hostname) {
    throw new Error("Tailscale MagicDNS 이름을 찾지 못했습니다.");
  }

  const publicUrl = `https://${hostname}`;
  const edgePort = process.env.HOMELAB_EDGE_PORT ?? "18443";
  return {
    hostname,
    publicUrl,
    edgeTarget: `http://127.0.0.1:${edgePort}`,
    loginUrl: `${publicUrl}/__integration/login`,
    browserApiBaseUrl: publicUrl,
    composeFiles: ["compose.yml", "compose.homelab.yml"],
    services: ["server", "web", "auth-bootstrap", "edge"],
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: HERE,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function composeArgs(project, files) {
  return ["compose", "-p", project, ...files.flatMap((file) => ["-f", file])];
}

if (action === "plan") {
  process.stdout.write(`${JSON.stringify(plan())}\n`);
} else if (action === "up") {
  const config = plan();
  const project = process.env.HOMELAB_COMPOSE_PROJECT ?? "heymoa-homelab";
  const env = {
    ...process.env,
    HOMELAB_PUBLIC_URL: config.publicUrl,
    NEXT_PUBLIC_API_BASE_URL: config.browserApiBaseUrl,
    SERVER_PORT: process.env.SERVER_PORT ?? "18090",
    SERVER_ACTUATOR_PORT: process.env.SERVER_ACTUATOR_PORT ?? "18091",
  };

  run(
    "docker",
    [...composeArgs(project, config.composeFiles), "build", "web"],
    {
      env,
    }
  );
  run(
    "docker",
    [
      ...composeArgs(project, config.composeFiles),
      "up",
      "-d",
      "--no-build",
      "--wait",
      "--wait-timeout",
      "180",
      ...config.services,
    ],
    { env }
  );
  run("tailscale", [
    "serve",
    "--bg",
    "--yes",
    "--https=443",
    config.edgeTarget,
  ]);

  process.stdout.write(
    `홈랩: ${config.publicUrl}\n테스트 로그인: ${config.loginUrl}\n`
  );
} else if (action === "down") {
  const config = plan();
  const project = process.env.HOMELAB_COMPOSE_PROJECT ?? "heymoa-homelab";
  run("tailscale", ["serve", "--https=443", "off"]);
  run("docker", [...composeArgs(project, config.composeFiles), "down"]);
} else {
  process.stderr.write("사용법: node homelab.mjs [plan|up|down]\n");
  process.exit(2);
}
