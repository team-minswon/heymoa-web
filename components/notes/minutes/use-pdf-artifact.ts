"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MinutesInclude } from "@/lib/notes/minutes/model";
import type {
  MinutesPdfArtifact,
  PrepareMinutesPdf,
} from "@/components/notes/minutes/render-minutes-pdf";

type PdfBuild<Key> =
  | { key: Key; status: "idle" | "building" | "failed" }
  | { key: Key; status: "ready"; artifact: MinutesPdfArtifact };

export function usePdfArtifact(
  open: boolean,
  version: string,
  include: MinutesInclude,
  build: PrepareMinutesPdf
) {
  const [session, setSession] = useState({ open, no: 0 });
  if (session.open !== open) setSession({ open, no: session.no + 1 });
  const key = useMemo(
    () => ({
      open,
      version,
      transcript: include.transcript,
      session: session.no,
    }),
    [open, version, include.transcript, session.no]
  );
  const currentKey = useRef(key);
  const request = useRef<{
    key: typeof key;
    controller: AbortController;
    promise: Promise<MinutesPdfArtifact>;
  } | null>(null);
  const [state, setState] = useState<PdfBuild<typeof key>>({
    key,
    status: "idle",
  });
  useLayoutEffect(() => {
    currentKey.current = key;
    return () => {
      request.current?.controller.abort();
      request.current = null;
    };
  }, [key]);
  const artifact =
    state.key === key && state.status === "ready" ? state.artifact : null;
  const pending = state.key === key && state.status === "building";
  const invalidated =
    open &&
    state.status !== "idle" &&
    state.key.session === key.session &&
    state.key !== key;
  const prepare = () => {
    if (artifact) return Promise.resolve(artifact);
    if (request.current?.key === key) return request.current.promise;
    const controller = new AbortController();
    setState({ key, status: "building" });
    const promise = build(include, controller.signal)
      .then((result) => {
        controller.signal.throwIfAborted();
        if (currentKey.current !== key)
          throw new DOMException("The document changed", "AbortError");
        setState({ key, status: "ready", artifact: result });
        return result;
      })
      .finally(() => {
        if (request.current?.controller === controller) {
          request.current = null;
        }
        setState((current) =>
          current.key === key && current.status === "building"
            ? { key, status: "failed" }
            : current
        );
      });
    request.current = { key, controller, promise };
    return promise;
  };
  return { artifact, pending, invalidated, prepare };
}
