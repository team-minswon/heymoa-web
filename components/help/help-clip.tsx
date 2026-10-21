"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, Pause, Play } from "lucide-react";

import { track } from "@/lib/analytics/track";
import { useHelpSlug } from "@/lib/help/analytics";
import { HelpZoomDialog } from "@/components/help/help-zoom-dialog";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { helpAssetUrl } from "@/lib/help/asset-url";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { cn } from "@/lib/utils";

/**
 * 가이드의 움직이는 설명. 소리 없는 짧은 루프 영상(WebM + MP4, 첫 장면 poster)이다.
 *
 * - **화면에 들어올 때만 재생**하고 벗어나면 멈춘다(IntersectionObserver) — 안 보이는 영상이 전송량과 배터리를 쓰지 않게.
 * - `prefers-reduced-motion` 이면 자동 재생하지 않고 poster 만 보인다. "재생" 버튼으로 직접 볼 수 있다.
 * - 영상을 누르거나 오른쪽 아래 크게 보기 버튼을 누르면 `HelpFigure` 와 같은 확대 창(Dialog)이 열려 처음부터 재생한다. 열려 있는 동안
 *   본문의 영상은 멈춘다. 확대 창에는 재생/일시정지와 진행 막대가 있다.
 * - 재생/일시정지 버튼은 키보드로 닿는다. 영상에 의존하지 않도록 따라 하는 단계는 본문 글에 따로 적는다.
 * - 파일은 `pnpm help:clips` 가 `public/help/clips/` 에 만든다.
 */
type ClipName = keyof typeof HELP_MEDIA extends infer K
  ? K extends `clips/${infer N}`
    ? N
    : never
  : never;

export function HelpClip({
  name,
  alt,
  caption,
}: {
  /** 확장자 없는 이름. 예: `new-meeting` → `clips/new-meeting.webm` · `.mp4` · `.webp`(poster) */
  name: ClipName;
  alt: string;
  caption?: string;
}) {
  const { width, height } = HELP_MEDIA[`clips/${name}`];
  const video = useRef<HTMLVideoElement>(null);
  const figure = useRef<HTMLElement>(null);
  const captionId = useId();
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const zoomButton = useRef<HTMLButtonElement>(null);
  const slug = useHelpSlug();
  const played = useRef(false);
  const openZoom = () => {
    track("help_clip_zoomed", { clip: name, slug });
    setZoomed(true);
  };

  useEffect(() => {
    // (matchMedia 가 없는 환경 — 서버 렌더 검사·오래된 브라우저 — 에서는 움직임 줄이기 설정이 없는 것으로 본다)
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches); // eslint-disable-line react-hooks/set-state-in-effect -- 브라우저 설정은 마운트한 뒤에만 읽는다(서버 HTML 과 같게)
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = video.current;
    const root = figure.current;
    if (
      !el ||
      !root ||
      reduced ||
      userPaused ||
      zoomed ||
      typeof IntersectionObserver === "undefined"
    ) {
      el?.pause(); // 움직임 줄이기를 켠 순간·확대 창이 열린 동안 재생 중이던 영상도 멈춘다
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [reduced, userPaused, zoomed]);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) {
      setUserPaused(false);
      void el.play().catch(() => undefined);
    } else {
      setUserPaused(true);
      el.pause();
    }
  };

  return (
    <figure ref={figure} data-reveal="" className="m-0 flex flex-col gap-2">
      <div className="group/clip relative overflow-hidden rounded-[16px] border border-[var(--tv-rule)] bg-[var(--tv-lav-soft)] shadow-(--help-shadow)">
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="metadata"
          poster={helpAssetUrl(`clips/${name}.webp`)}
          width={width}
          height={height}
          aria-label={alt}
          aria-describedby={caption ? captionId : undefined}
          onPlay={() => {
            setPlaying(true);
            // 화면에 들어와 자동으로 시작해도 한 번만 센다(열람 중 재생된 영상 수).
            if (!played.current) {
              played.current = true;
              track("help_clip_played", { clip: name, slug });
            }
          }}
          onPause={() => setPlaying(false)}
          className="block h-auto w-full"
        >
          <source src={helpAssetUrl(`clips/${name}.webm`)} type="video/webm" />
          <source src={helpAssetUrl(`clips/${name}.mp4`)} type="video/mp4" />
        </video>
        {/* 마우스용 덮개. 키보드는 아래 크게 보기 버튼으로 같은 곳에 닿는다. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={openZoom}
          className="absolute inset-0 cursor-zoom-in bg-transparent p-0"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `${alt} — 일시정지` : `${alt} — 재생`}
          className={cn(
            "absolute right-14 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 text-[var(--tv-ink)] help-fade hover:bg-white hover:text-[var(--tv-brand-deep)] motion-reduce:transition-none",
            FOCUS
          )}
        >
          {playing ? (
            <Pause aria-hidden className="size-4" />
          ) : (
            <Play aria-hidden className="size-4" />
          )}
        </button>
        <button
          ref={zoomButton}
          type="button"
          onClick={openZoom}
          aria-label={`${alt} — 크게 보기`}
          className={cn(
            "absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 text-[var(--tv-ink)] opacity-0 help-fade hover:bg-white hover:text-[var(--tv-brand-deep)] group-hover/clip:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none",
            FOCUS
          )}
        >
          <Maximize2 aria-hidden className="size-4" />
        </button>
      </div>
      <HelpZoomDialog
        open={zoomed}
        onOpenChange={setZoomed}
        title={alt}
        caption={caption}
        naturalWidth={width}
        finalFocus={() => zoomButton.current ?? true}
      >
        <ZoomPlayer
          name={name}
          alt={alt}
          width={width}
          height={height}
          reduced={reduced}
        />
      </HelpZoomDialog>
      {caption ? (
        <figcaption
          id={captionId}
          className="m-0 text-[14px] leading-[1.65] text-[var(--tv-muted)]"
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * 확대 창의 영상. 열릴 때 처음부터 재생하고(움직임 줄이기면 poster 와 재생 버튼만), 재생/일시정지와 진행 막대를 둔다.
 * Space 는 일시정지/재생이다(버튼·막대에 포커스가 있으면 그 컨트롤의 기본 동작).
 */
function ZoomPlayer({
  name,
  alt,
  width,
  height,
  reduced,
}: {
  name: ClipName;
  alt: string;
  width: number;
  height: number;
  reduced: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== " " || event.defaultPrevented) return;
        if ((event.target as HTMLElement).closest("button, input")) return;
        event.preventDefault();
        toggle();
      }}
      className="flex flex-col gap-2"
    >
      <video
        ref={video}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        poster={helpAssetUrl(`clips/${name}.webp`)}
        width={width}
        height={height}
        aria-label={alt}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        className="block h-auto max-h-[calc(92vh-6rem)] w-full rounded-[12px] bg-[var(--tv-lav-soft)] object-contain"
      >
        <source src={helpAssetUrl(`clips/${name}.webm`)} type="video/webm" />
        <source src={helpAssetUrl(`clips/${name}.mp4`)} type="video/mp4" />
      </video>
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "일시정지" : "재생"}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-[var(--tv-ink)] help-fade hover:bg-[var(--tv-lav-soft)] motion-reduce:transition-none",
            FOCUS
          )}
        >
          {playing ? (
            <Pause aria-hidden className="size-4" />
          ) : (
            <Play aria-hidden className="size-4" />
          )}
        </button>
        <input
          type="range"
          aria-label="재생 위치"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(time, duration || 1)}
          onChange={(event) => {
            const el = video.current;
            if (el) el.currentTime = Number(event.target.value);
            setTime(Number(event.target.value));
          }}
          className={cn("h-1 min-w-0 flex-1 cursor-pointer accent-[var(--tv-ink)]", FOCUS)}
        />
      </div>
    </div>
  );
}
