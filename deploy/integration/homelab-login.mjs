import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const USER_ID = "01K0000000001";
const DEFAULT_RETURN_PATH = "/w/01K0000000010/notes/01K0000000031?view=full";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function loginResponse(identity) {
  if (!identity) {
    throw new Error("Tailscale identity가 필요합니다.");
  }

  const secret = process.env.ACCESS_TOKEN_SECRET;
  const publicUrl = process.env.HOMELAB_PUBLIC_URL;
  if (!secret || !publicUrl) {
    throw new Error("홈랩 인증 환경변수가 빠졌습니다.");
  }

  const now = Number(process.env.NOW_SECONDS ?? Math.floor(Date.now() / 1000));
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: USER_ID,
    token_type: "access",
    iat: now,
    exp: now + 86_400,
  });
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(input)
    .digest("base64url");
  const token = `${input}.${signature}`;
  const returnPath = process.env.HOMELAB_RETURN_PATH ?? DEFAULT_RETURN_PATH;

  return {
    token,
    location: new URL(returnPath, publicUrl).toString(),
    cookie: `access_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
  };
}

if (process.argv[2] === "token") {
  try {
    process.stdout.write(
      `${JSON.stringify(loginResponse(process.env.TAILSCALE_USER_LOGIN))}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
} else {
  const port = Number(process.env.PORT ?? 3001);
  createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');
      return;
    }

    if (request.url !== "/__integration/login") {
      response.writeHead(404).end();
      return;
    }

    try {
      const login = loginResponse(request.headers["tailscale-user-login"]);
      response.writeHead(302, {
        location: login.location,
        "set-cookie": login.cookie,
        "cache-control": "no-store",
      });
      response.end();
    } catch (error) {
      response.writeHead(403, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(`${error.message}\n`);
    }
  }).listen(port, "0.0.0.0");
}
