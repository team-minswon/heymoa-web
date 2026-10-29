/** 이만큼(px) 움직이기 전까지는 끌기가 아니라 클릭이다 */
export const PAN_THRESHOLD = 5;

/** 끌어서 움직일 수 있는 축: 가로로 넘치는 판(x), 세로로 넘치는 스크롤 부모(y) */
export type PanAxes = { x: boolean; y: boolean };
/** 이번 끌기가 움직이는 축. `xy` 는 Shift 를 누르고 끌 때만이다 */
export type PanAxis = "x" | "y" | "xy";
export type PanStep = { dragging: false } | { dragging: true; axis: PanAxis; left: number; top: number };

/**
 * 문턱을 넘는 순간 어느 축으로 끌 것인지 정한다. 움직일 수 있는 축이 둘이면 더 많이 움직인 쪽, 하나뿐이면 그 축이다.
 * Shift 를 누르고 끌 때만 두 축을 함께 허용한다.
 */
export function lockAxis(dx: number, dy: number, axes: PanAxes, shift = false): PanAxis | null {
  if (axes.x && axes.y) return shift ? "xy" : Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  return axes.x ? "x" : axes.y ? "y" : null;
}

/**
 * 잡아 끌기 한 번의 상태. 눌렀을 때의 자리와 스크롤 값을 기억하고, 움직인 거리가 `threshold` 를 넘으면 그때부터 「끌기」다.
 * - 문턱을 넘는 순간 한 축으로 고정한다(`lockAxis`). 고정된 축의 반대쪽은 이 끌기가 끝날 때까지 움직이지 않는다.
 * - 문턱을 넘은 자리의 포인터를 새 원점으로 삼는다. 누른 자리가 원점이면 넘는 순간 내용이 문턱만큼 한 번에 튄다.
 * - 끌기가 된 뒤의 `up()` 은 true 를 돌려준다 — 그 뒤에 따라오는 클릭은 삼켜야 한다(끌다가 점을 누르지 않게).
 * DOM 을 모른다. 훅(`useDragPan`)이 이 값을 스크롤 컨테이너에 적용한다.
 */
export function panGesture(threshold = PAN_THRESHOLD) {
  let origin: { x: number; y: number; left: number; top: number; axes: PanAxes } | null = null;
  let axis: PanAxis | null = null;
  return {
    down(x: number, y: number, left: number, top: number, axes: PanAxes = { x: true, y: true }) {
      origin = { x, y, left, top, axes };
      axis = null;
    },
    /** 눌러 둔 게 없으면 null. 끌기가 아직 아니면 `dragging: false`, 끌기면 고정된 축과 옮겨야 할 스크롤 값 */
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
    /** 끝났다. 끌기였으면 true */
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

// ── 관성 ────────────────────────────────────────────────────────────────────────

export type PanSample = { t: number; x: number; y: number };
/** 놓는 순간 직전 이만큼(ms)의 움직임으로 속도를 잰다 */
export const GLIDE_WINDOW_MS = 80;
/** 속도가 줄어드는 시간 상수(ms). 속도는 `e^(-t/τ)` 로 줄어든다 */
export const GLIDE_TAU_MS = 120;
/** 관성이 이어지는 가장 긴 시간(ms). 짧고 부드럽게 멈춘다 */
export const GLIDE_MAX_MS = 400;
/** 이보다 느리면 멈춘 것으로 본다(px/ms) */
export const GLIDE_MIN_V = 0.03;
/** 놓을 때 속도의 상한(px/ms) — 한 번 쓸어도 판 끝까지 날아가지 않는다 */
export const GLIDE_MAX_V = 3;

/**
 * 놓을 때의 포인터 속도(px/ms). 마지막 `GLIDE_WINDOW_MS` 안의 첫 표본에서 마지막 표본까지의 평균이고, 놓기 전에 포인터가 멈춰 있었으면
 * (마지막 표본이 50ms 보다 오래됐으면) 0 이다. 상한은 `GLIDE_MAX_V`.
 */
export function releaseVelocity(samples: readonly PanSample[], now: number, window = GLIDE_WINDOW_MS) {
  const recent = samples.filter((sample) => now - sample.t <= window);
  const [first, last] = [recent[0], recent.at(-1)];
  if (!first || !last || last === first || last.t - first.t < 8 || now - last.t > 50) return { vx: 0, vy: 0 };
  const cap = (v: number) => Math.max(-GLIDE_MAX_V, Math.min(GLIDE_MAX_V, v));
  const span = last.t - first.t;
  return { vx: cap((last.x - first.x) / span), vy: cap((last.y - first.y) / span) };
}

/** 마찰로 속도가 줄어드는 한 걸음: `dt`(ms) 동안 옮길 거리와 그 뒤의 속도 */
export function glideStep(v: number, dt: number) {
  const keep = Math.exp(-dt / GLIDE_TAU_MS);
  return { delta: v * GLIDE_TAU_MS * (1 - keep), v: v * keep };
}

/** 더 굴러갈 필요가 없다: 너무 느려졌거나 시간이 다 됐다 */
export const glideDone = (v: number, elapsed: number) => Math.abs(v) < GLIDE_MIN_V || elapsed >= GLIDE_MAX_MS;
