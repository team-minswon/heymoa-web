"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MinutesInclude } from "@/lib/notes/minutes/model";
import type {
  MinutesPdfArtifact,
  PrepareMinutesPdf,
} from "@/components/notes/minutes/render-minutes-pdf";

/** 창·옵션·문서 판이 바뀌면 이전 결과를 감추고 늦은 완료도 버린다. 명시한 동작에서만 생성한다. */
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
  const [state, setState] = useState<{
    key: typeof key;
    artifact: MinutesPdfArtifact | null;
    pending: boolean;
    attempted: boolean;
  }>({ key, artifact: null, pending: false, attempted: false });
  useLayoutEffect(() => {
    currentKey.current = key;
    return () => {
      request.current?.controller.abort();
      request.current = null;
    };
  }, [key]);
  const artifact = state.key === key ? state.artifact : null;
  const pending = state.key === key && state.pending;
  const invalidated =
    open &&
    state.attempted &&
    state.key.session === key.session &&
    state.key !== key;
  const prepare = () => {
    if (artifact) return Promise.resolve(artifact);
    if (request.current?.key === key) return request.current.promise;
    const controller = new AbortController();
    setState({ key, artifact: null, pending: true, attempted: true });
    const promise = build(include, controller.signal)
      .then((result) => {
        controller.signal.throwIfAborted();
        if (currentKey.current !== key)
          throw new DOMException("문서가 변경되었습니다", "AbortError");
        setState({ key, artifact: result, pending: false, attempted: true });
        return result;
      })
      .finally(() => {
        if (request.current?.controller === controller) {
          request.current = null;
        }
        setState((current) =>
          current.key === key ? { ...current, pending: false } : current
        );
      });
    request.current = { key, controller, promise };
    return promise;
  };
  return { artifact, pending, invalidated, prepare };
}
