import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));

function run(script: string, args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [join(HERE, script), ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function sign(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

describe("homelab integration runtime", () => {
  it("Tailscale DNS 이름 하나로 HTTPS web·API·WebSocket 실행을 계획한다", () => {
    const result = run("homelab.mjs", ["plan"], {
      TAILSCALE_STATUS_JSON: JSON.stringify({
        Self: {
          DNSName: "homelab.tail523ef0.ts.net.",
          TailscaleIPs: ["100.71.128.71"],
        },
      }),
      HOMELAB_EDGE_PORT: "18443",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      hostname: "homelab.tail523ef0.ts.net",
      publicUrl: "https://homelab.tail523ef0.ts.net",
      edgeTarget: "http://127.0.0.1:18443",
      loginUrl: "https://homelab.tail523ef0.ts.net/__integration/login",
      browserApiBaseUrl: "https://homelab.tail523ef0.ts.net",
      composeFiles: ["compose.yml", "compose.homelab.yml"],
      services: ["server", "web", "auth-bootstrap", "edge"],
    });
  });

  it("Tailscale identity가 있는 요청만 seeded 사용자 토큰을 받는다", () => {
    const secret = "integration-access-secret-please-change-me-32";
    const result = run("homelab-login.mjs", ["token"], {
      ACCESS_TOKEN_SECRET: secret,
      HOMELAB_PUBLIC_URL: "https://homelab.tail523ef0.ts.net",
      TAILSCALE_USER_LOGIN: "min@example.com",
      NOW_SECONDS: "1787895600",
    });

    expect(result.status, result.stderr).toBe(0);
    const response = JSON.parse(result.stdout) as {
      token: string;
      location: string;
      cookie: string;
    };
    const [header, payload, signature] = response.token.split(".");

    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      sub: "01K0000000001",
      token_type: "access",
      iat: 1787895600,
      exp: 1787982000,
    });
    expect(signature).toBe(sign(`${header}.${payload}`, secret));
    expect(response.location).toBe(
      "https://homelab.tail523ef0.ts.net/w/01K0000000010/notes/01K0000000031?view=full"
    );
    expect(response.cookie).toContain(
      `access_token=${response.token}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
  });

  it("Tailscale identity가 없으면 테스트 로그인을 거부한다", () => {
    const result = run("homelab-login.mjs", ["token"], {
      ACCESS_TOKEN_SECRET: "integration-access-secret-please-change-me-32",
      HOMELAB_PUBLIC_URL: "https://homelab.tail523ef0.ts.net",
      TAILSCALE_USER_LOGIN: "",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Tailscale identity가 필요합니다");
  });
});
