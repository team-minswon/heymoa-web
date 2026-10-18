"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { helpAssetUrl } from "@/lib/help/asset-url";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { cn } from "@/lib/utils";

/**
 * 가이드의 움직이는 설명. 소리 없는 짧은 루프 영상(WebM + MP4, 첫 장면 poster)이다.
 *
 * - **화면에 들어올 때만 재생**하고 벗어나면 멈춘다(IntersectionObserver) — 안 보이는 영상이 전송량과 배터리를 쓰지 않게.
 * - `prefers-reduced-motion` 이면 자동 재생하지 않고 poster 만 보인다. "재생" 버튼으로 직접 볼 수 있다.
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
      typeof IntersectionObserver === "undefined"
    ) {
      el?.pause(); // 움직임 줄이기를 켠 순간 재생 중이던 영상도 멈춘다
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
  }, [reduced, userPaused]);

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
      <div className="relative overflow-hidden rounded-[16px] border border-[var(--tv-rule)] bg-[var(--tv-lav-soft)] shadow-(--help-shadow)">
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
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="block h-auto w-full"
        >
          <source src={helpAssetUrl(`clips/${name}.webm`)} type="video/webm" />
          <source src={helpAssetUrl(`clips/${name}.mp4`)} type="video/mp4" />
        </video>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `${alt} — 일시정지` : `${alt} — 재생`}
          className={cn(
            "absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 text-[var(--tv-ink)] help-fade hover:bg-white hover:text-[var(--tv-brand-deep)] motion-reduce:transition-none",
            FOCUS
          )}
        >
          {playing ? (
            <Pause aria-hidden className="size-4" />
          ) : (
            <Play aria-hidden className="size-4" />
          )}
        </button>
      </div>
      {caption ? (
        <figcaption
          id={captionId}
          className="m-0 text-[14px] leading-[1.65] break-keep text-[var(--tv-muted)]"
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
