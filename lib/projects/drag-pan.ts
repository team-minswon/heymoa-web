export const PAN_THRESHOLD = 5;

export type PanAxes = { x: boolean; y: boolean };
export type PanAxis = "x" | "y" | "xy";
export type PanStep = { dragging: false } | { dragging: true; axis: PanAxis; left: number; top: number };

export function lockAxis(dx: number, dy: number, axes: PanAxes, shift = false): PanAxis | null {
  if (axes.x && axes.y) return shift ? "xy" : Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  return axes.x ? "x" : axes.y ? "y" : null;
}

export function panGesture(threshold = PAN_THRESHOLD) {
  let origin: { x: number; y: number; left: number; top: number; axes: PanAxes } | null = null;
  let axis: PanAxis | null = null;
  return {
    down(x: number, y: number, left: number, top: number, axes: PanAxes = { x: true, y: true }) {
      origin = { x, y, left, top, axes };
      axis = null;
    },
    move(x: number, y: number, shift = false): PanStep | null {
      if (!origin) return null;
      if (!axis) {
        const [dx, dy] = [x - origin.x, y - origin.y];
        if (Math.hypot(dx, dy) <= threshold) return { dragging: false };
        const locked = lockAxis(dx, dy, origin.axes, shift);
        if (!locked) return { dragging: false };
        axis = locked;
        origin = { ...origin, x, y };
        return { dragging: true, axis, left: origin.left, top: origin.top };
      }
      return {
        dragging: true,
        axis,
        left: axis === "y" ? origin.left : origin.left - (x - origin.x),
        top: axis === "x" ? origin.top : origin.top - (y - origin.y),
      };
    },
    up() {
      const wasDrag = axis !== null;
      origin = null;
      axis = null;
      return wasDrag;
    },
    get active() {
      return origin !== null;
    },
    get dragging() {
      return axis !== null;
    },
    get axis() {
      return axis;
    },
  };
}

export type PanSample = { t: number; x: number; y: number };
export const GLIDE_WINDOW_MS = 80;
export const GLIDE_TAU_MS = 120;
export const GLIDE_MAX_MS = 400;
export const GLIDE_MIN_V = 0.03;
export const GLIDE_MAX_V = 3;

export function releaseVelocity(samples: readonly PanSample[], now: number, window = GLIDE_WINDOW_MS) {
  const recent = samples.filter((sample) => now - sample.t <= window);
  const [first, last] = [recent[0], recent.at(-1)];
  if (!first || !last || last === first || last.t - first.t < 8 || now - last.t > 50) return { vx: 0, vy: 0 };
  const cap = (v: number) => Math.max(-GLIDE_MAX_V, Math.min(GLIDE_MAX_V, v));
  const span = last.t - first.t;
  return { vx: cap((last.x - first.x) / span), vy: cap((last.y - first.y) / span) };
}

export function glideStep(v: number, dt: number) {
  const keep = Math.exp(-dt / GLIDE_TAU_MS);
  return { delta: v * GLIDE_TAU_MS * (1 - keep), v: v * keep };
}

export const glideDone = (v: number, elapsed: number) => Math.abs(v) < GLIDE_MIN_V || elapsed >= GLIDE_MAX_MS;
