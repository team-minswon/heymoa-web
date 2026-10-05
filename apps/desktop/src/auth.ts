import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  AUTH_TIMEOUT_MS,
  AuthOutcome,
  authorizeUrl,
  ConnectionRequest,
  nativeCallback,
} from "./auth-policy";

type Dependencies = {
  apiOrigin: string;
  post: (
    path: string,
    body: Record<string, string>,
    signal: AbortSignal
  ) => Promise<unknown>;
  openBrowser: (url: string) => Promise<unknown>;
  now?: () => number;
  timeoutMs?: number;
};
type Pending = {
  state: string;
  verifier: string;
  kind: "login" | "connection";
  connection?: ConnectionRequest;
  phase: "starting" | "waiting" | "exchanging";
  deadline: number;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  resolve: (outcome: AuthOutcome) => void;
};

/** Owns native auth secrets. Neither the dependency API nor outcomes expose tokens. */
export class DesktopAuthBroker {
  private pending: Pending | null = null;
  constructor(private readonly dependencies: Dependencies) {}

  begin(connection?: ConnectionRequest): Promise<AuthOutcome> {
    if (this.pending)
      return Promise.resolve({ status: "error", reason: "busy" });
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const timeoutMs = this.dependencies.timeoutMs ?? AUTH_TIMEOUT_MS;
    return new Promise((resolve) => {
      const pending: Pending = {
        state,
        verifier,
        kind: connection ? "connection" : "login",
        connection,
        phase: "starting",
        deadline: this.now() + timeoutMs,
        controller: new AbortController(),
        timer: setTimeout(
          () => this.finish(pending, { status: "error", reason: "timeout" }),
          timeoutMs
        ),
        resolve,
      };
      this.pending = pending;
      void this.launch(pending);
    });
  }

  cancel(): void {
    if (this.pending) this.finish(this.pending, { status: "cancelled" });
  }

  async receive(value: string): Promise<boolean> {
    const callback = nativeCallback(value);
    const pending = this.pending;
    if (
      !callback ||
      !pending ||
      pending.phase !== "waiting" ||
      callback.kind !== pending.kind
    )
      return false;
    const actual = Buffer.from(callback.state);
    const expected = Buffer.from(pending.state);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    if (pending.deadline <= this.now()) {
      this.finish(pending, { status: "error", reason: "timeout" });
      return false;
    }
    if (callback.kind === "connection") {
      if (callback.provider !== pending.connection?.provider) return false;
      this.finish(
        pending,
        callback.status === "success"
          ? { status: "success" }
          : { status: "error", reason: "authentication_failed" }
      );
      return true;
    }
    if ("error" in callback) {
      this.finish(pending, {
        status: "error",
        reason: "authentication_failed",
      });
      return true;
    }
    pending.phase = "exchanging";
    try {
      await this.dependencies.post(
        "/v1/auth/desktop/exchange",
        {
          code: callback.code,
          state: pending.state,
          codeVerifier: pending.verifier,
        },
        pending.controller.signal
      );
      this.finish(pending, { status: "success" });
    } catch {
      this.finish(pending, { status: "error", reason: "unavailable" });
    }
    return true;
  }

  private now() {
    return (this.dependencies.now ?? Date.now)();
  }

  private async launch(pending: Pending): Promise<void> {
    const connection = pending.connection;
    const path = connection
      ? `/v1/workspaces/${connection.workspaceId}/integrations/${connection.provider}/desktop-ticket`
      : "/v1/auth/desktop/start";
    const body: Record<string, string> = { state: pending.state };
    if (!connection)
      body.codeChallenge = createHash("sha256")
        .update(pending.verifier)
        .digest("base64url");
    try {
      const result = await this.dependencies.post(
        path,
        body,
        pending.controller.signal
      );
      if (this.pending !== pending) return;
      if (pending.deadline <= this.now()) {
        this.finish(pending, { status: "error", reason: "timeout" });
        return;
      }
      const value =
        result && typeof result === "object"
          ? (result as Record<string, unknown>).authorizeUrl
          : undefined;
      const url = authorizeUrl(value, this.dependencies.apiOrigin);
      pending.phase = "waiting";
      await this.dependencies.openBrowser(url);
    } catch {
      this.finish(pending, { status: "error", reason: "unavailable" });
    }
  }

  private finish(pending: Pending, outcome: AuthOutcome): void {
    if (this.pending !== pending) return;
    if (outcome.status === "success" && pending.deadline <= this.now())
      outcome = { status: "error", reason: "timeout" };
    this.pending = null;
    clearTimeout(pending.timer);
    pending.controller.abort();
    pending.verifier = "";
    pending.state = "";
    pending.resolve(outcome);
  }
}
