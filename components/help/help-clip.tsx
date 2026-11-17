"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, Pause, Play } from "lucide-react";

import { trackHelp, useHelpSlug } from "@/lib/help/analytics";
import { HelpZoomDialog } from "@/components/help/help-zoom-dialog";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { helpAssetUrl } from "@/lib/help/asset-url";
import { HELP_MEDIA } from "@/lib/help/media-manifest";
import { localizedHelpMedia } from "@/lib/help/localized-media";
import { cn } from "@/lib/utils";

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
  name: ClipName;
  alt: string;
  caption?: string;
}) {
  const { path, width, height } = localizedHelpMedia(`clips/${name}`, useLocale());
  const video = useRef<HTMLVideoElement>(null);
  const figure = useRef<HTMLElement>(null);
  const captionId = useId();
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const zoomButton = useRef<HTMLButtonElement>(null);
  const slug = useHelpSlug();
  const t = useTranslations("help.media");
  const played = useRef(false);
  const openZoom = () => {
    trackHelp("help_clip_zoomed", { clip: name, slug });
    setZoomed(true);
  };

  useEffect(() => {
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
      el?.pause();
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
          poster={helpAssetUrl(`${path}.webp`)}
          width={width}
          height={height}
          aria-label={alt}
          aria-describedby={caption ? captionId : undefined}
          onPlay={() => {
            setPlaying(true);
            if (!played.current) {
              played.current = true;
              trackHelp("help_clip_played", { clip: name, slug });
            }
          }}
          onPause={() => setPlaying(false)}
          className="block h-auto w-full"
        >
          <source src={helpAssetUrl(`${path}.webm`)} type="video/webm" />
          <source src={helpAssetUrl(`${path}.mp4`)} type="video/mp4" />
        </video>
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
          aria-label={playing ? t("pauseNamed", { alt }) : t("playNamed", { alt })}
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
          aria-label={t("zoom", { alt })}
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
          path={path}
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

function ZoomPlayer({
  path,
  alt,
  width,
  height,
  reduced,
}: {
  path: string;
  alt: string;
  width: number;
  height: number;
  reduced: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const t = useTranslations("help.media");

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
        poster={helpAssetUrl(`${path}.webp`)}
        width={width}
        height={height}
        aria-label={alt}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        className="block h-auto max-h-[calc(92vh-6rem)] w-full rounded-[12px] bg-[var(--tv-lav-soft)] object-contain"
      >
        <source src={helpAssetUrl(`${path}.webm`)} type="video/webm" />
        <source src={helpAssetUrl(`${path}.mp4`)} type="video/mp4" />
      </video>
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("pause") : t("play")}
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
          aria-label={t("seek")}
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
