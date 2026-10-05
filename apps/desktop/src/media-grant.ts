import { randomUUID } from "node:crypto";
import type {
  DisplayMediaRequestHandlerHandlerRequest,
  WebFrameMain,
} from "electron";
import { isTrustedUrl } from "./policy";
export const CAPTURE_GRANT_TTL_MS = 120_000;
type Grant = {
  id: string;
  frame: WebFrameMain;
  deadline: number;
  displayPermission: boolean;
  microphonePermission: boolean;
  displaySelected: boolean;
  active: boolean;
};
export class MediaGrant {
  private current: Grant | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly changed: (active: boolean) => void = () => {},
    private readonly trustedUrl = isTrustedUrl
  ) {}
  begin(frame: WebFrameMain): string {
    if (this.current) throw new Error("CAPTURE_ALREADY_REQUESTED");
    const id = randomUUID();
    this.current = {
      id,
      frame,
      deadline: Date.now() + CAPTURE_GRANT_TTL_MS,
      displayPermission: false,
      microphonePermission: false,
      displaySelected: false,
      active: false,
    };
    this.expiry = setTimeout(() => this.revoke(), CAPTURE_GRANT_TTL_MS);
    this.changed(true);
    return id;
  }
  alive(frame: WebFrameMain | null, url: string, origin: string): boolean {
    const grant = this.current;
    return Boolean(
      grant &&
      frame &&
      grant.frame === frame &&
      this.trustedUrl(url, origin) &&
      (grant.active || Date.now() < grant.deadline)
    );
  }
  allowPermission(
    frame: WebFrameMain,
    url: string,
    origin: string,
    mediaTypes: unknown
  ): boolean {
    if (!this.alive(frame, url, origin) || !Array.isArray(mediaTypes))
      return false;
    const grant = this.current!;
    if (
      mediaTypes.length === 0 &&
      !grant.displayPermission &&
      !grant.displaySelected
    ) {
      grant.displayPermission = true;
      return true;
    }
    if (
      mediaTypes.length === 1 &&
      mediaTypes[0] === "audio" &&
      !grant.microphonePermission
    ) {
      grant.microphonePermission = true;
      return true;
    }
    return false;
  }
  claimDisplay(
    request: DisplayMediaRequestHandlerHandlerRequest,
    mainFrame: WebFrameMain,
    origin: string
  ): string | null {
    if (
      request.frame !== mainFrame ||
      !request.userGesture ||
      !request.audioRequested ||
      !request.videoRequested ||
      !this.alive(request.frame, request.securityOrigin, origin)
    )
      return null;
    const grant = this.current!;
    if (!grant.displayPermission || grant.displaySelected) return null;
    grant.displaySelected = true;
    return grant.id;
  }
  valid(
    id: string,
    frame: WebFrameMain | null,
    url: string,
    origin: string
  ): boolean {
    return this.current?.id === id && this.alive(frame, url, origin);
  }
  ready(id: string): void {
    const grant = this.current;
    if (
      !grant ||
      grant.id !== id ||
      !grant.displaySelected ||
      !grant.microphonePermission ||
      Date.now() >= grant.deadline
    )
      throw new Error("CAPTURE_GRANT_NOT_READY");
    grant.active = true;
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = null;
  }
  end(id: string): void {
    if (this.current?.id === id) this.revoke();
  }
  revoke(): void {
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = null;
    this.current = null;
    this.changed(false);
  }
}
export function captureId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new Error("INVALID_CAPTURE_ID");
  return value;
}
