"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import { scopeMarker } from "@/lib/chat/scope-marker";
import { cn } from "@/lib/utils";

/**
 * 칩이 문장 안에 사는 입력. `@` 를 친 자리에 칩이 박혀 문장이 곧 이번 요청이 된다.
 *
 * 문장 중간에 지울 수 없는 덩어리를 넣으려면 `contenteditable` 이어야 한다. 브라우저 기본에서
 * 셋을 붙잡는다.
 *
 * - 칩은 `contenteditable="false"` 라 캐럿이 못 들어가고 백스페이스 한 번에 통째로 지워진다.
 * - 붙여넣기는 평문만 넣는다.
 * - 한 줄로 시작해 `max-height` 안에서 스크롤한다.
 *
 * 범위를 정하는 것은 `noteIds`·`projectIds` 배열이다. 문장의 마커(`@[제목](noteId:…)`)는
 * 배열을 대신하지 않고 「이 자리가 그중 무엇인가」를 덧붙인다. 규칙은 `scope-marker.ts`.
 */

export type MentionHandle = {
  /** 지금 편집기가 들고 있는 것. 전송 직전에 읽는다. */
  read: () => { text: string; chips: ScopeChip[] };
  clear: () => void;
  focus: () => void;
  /** 캐럿 앞의 `@질의`를 칩으로 바꾼다. 피커가 고른 뒤 부른다. */
  commitMention: (chip: ScopeChip) => void;
  /** 문장 맨 앞에 칩을 넣는다. 회의록 프리필이 쓴다. */
  prepend: (chip: ScopeChip) => void;
  /** 문장 끝에 글자를 붙인다. 추천 질문이 쓴다 — 이미 있는 칩은 그대로 둔다. */
  append: (text: string) => void;
};

const CHIP = "data-scope-chip";

/**
 * lucide `Folder`·`FileText` 의 path 를 옮긴 것. 칩은 React 밖에서 만드는 DOM 노드라
 * 컴포넌트를 못 부른다. lucide 버전이 오르면 같이 본다.
 */
const ICON_PATHS: Record<ScopeChip["kind"], string[]> = {
  project: [
    "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
  ],
  note: [
    "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
    "M14 2v5a1 1 0 0 0 1 1h5",
    "M10 9H8",
    "M16 13H8",
    "M16 17H8",
  ],
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** 목록과 같은 아이콘. `contentEditable="false"` 안이라 부분 선택이 안 된다. */
function iconElement(kind: ScopeChip["kind"]) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "size-3.5 shrink-0");
  ICON_PATHS[kind].forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  });
  return svg;
}

function chipElement(chip: ScopeChip) {
  const el = document.createElement("span");
  el.setAttribute(CHIP, chip.kind);
  el.setAttribute("data-scope-id", chip.id);
  el.setAttribute("data-scope-title", chip.title);
  el.contentEditable = "false";
  // 높이·바탕은 말풍선 칩과 한 벌이라 `scopeChipClass` 가 든다(이유는 그 파일). 여기서
  // 더하는 것은 입력에서만 필요한 폭 상한이다 — 긴 제목이 쓰던 문장을 가린다.
  el.className = scopeChipClass(chip.kind, { extra: "max-w-[13rem]" });
  // SVG 라 `textContent` 에 안 잡힌다 — 문장을 읽을 때 걸러낼 것이 없다.
  const icon = iconElement(chip.kind);
  const label = document.createElement("span");
  label.textContent = chip.title;
  label.className = "truncate";
  el.append(icon, label);
  return el;
}

/**
 * 캐럿 앞 `count` 글자를 지운다. 캐럿은 노드 사이에도 서고 한글 입력 중 텍스트 노드가
 * 여럿으로 갈리므로 노드 하나로 가정하지 않는다 — `@질의` 가 남으면 칩이 두 번 박힌다.
 * 칩을 만나면 멈춘다.
 */
function deleteBeforeCaret(range: Range, count: number) {
  let remaining = count;
  // 문장 길이를 넘게 돌 일은 없지만 상한을 둔다.
  for (let guard = 0; remaining > 0 && guard < 200; guard += 1) {
    const node = range.startContainer;
    const offset = range.startOffset;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const previous = node.childNodes[offset - 1];
      if (!previous || previous.nodeType !== Node.TEXT_NODE) break;
      range.setStart(previous, (previous as Text).length);
      continue;
    }

    const text = node as Text;
    const take = Math.min(remaining, offset);
    if (take > 0) {
      text.deleteData(offset - take, take);
      remaining -= take;
    }
    range.setStart(text, offset - take);
    if (remaining === 0) break;

    // 이 노드를 다 썼다. 부모에서 한 칸 앞으로 나가 다음 바퀴에 이어 지운다.
    const parent = text.parentNode;
    if (!parent) break;
    range.setStart(parent, [...parent.childNodes].indexOf(text));
  }
  range.collapse(true);
}

/**
 * 편집기가 든 문장. 칩은 마커로 낸다(`@[주간 회의](noteId:…)`). `textContent` 는 칩 안의
 * 라벨까지 이어 붙이므로 자식을 훑으며 칩만 바꿔치기하고, 나머지(`<br>` 은 안 세고 SVG 는
 * 글자가 없다)는 `textContent` 와 같게 둔다.
 */
function readSentence(root: HTMLElement | null) {
  if (!root) return "";
  let out = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue ?? "";
        return;
      }
      const el = child as HTMLElement;
      const kind = el.getAttribute?.(CHIP) as ScopeChip["kind"] | null;
      const id = el.getAttribute?.("data-scope-id");
      if (kind && id) {
        out += scopeMarker({
          kind,
          id,
          title: el.getAttribute("data-scope-title") ?? "",
        });
        return;
      }
      walk(child);
    });
  };
  walk(root);
  return out.trim();
}

/**
 * `@` 뒤의 질의. 공백에서 끊지 않는다 — 제목이 대개 여러 낱말이라 끊으면 둘째 낱말에서
 * 피커가 닫히고, 고르려던 Enter 가 전송된다. 끝은 맞는 것이 없을 때이고 그 판정은 컴포저가
 * 한다(`matchScope`). 줄바꿈과 다음 `@` 만 경계다.
 */
const MENTION = /(?:^|\s)@([^@\n]*)$/;

export function MentionInput({
  ref,
  placeholder,
  disabled,
  isPickerOpen,
  onQueryChange,
  onChipsChange,
  onSubmit,
}: {
  ref: React.RefObject<MentionHandle | null>;
  placeholder: string;
  disabled?: boolean;
  /** `@` 피커가 열려 있다. 그동안 Enter 는 피커의 것이다. */
  isPickerOpen?: boolean;
  /** 캐럿 앞의 `@질의`. 없으면 `null` — 피커를 닫으라는 뜻이다. */
  onQueryChange: (query: string | null) => void;
  onChipsChange: (chips: ScopeChip[]) => void;
  onSubmit: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const readChips = useCallback((): ScopeChip[] => {
    const seen = new Set<string>();
    return [...(box.current?.querySelectorAll(`[${CHIP}]`) ?? [])].flatMap(
      (el) => {
        const kind = el.getAttribute(CHIP) as ScopeChip["kind"];
        const id = el.getAttribute("data-scope-id") ?? "";
        const key = `${kind}:${id}`;
        if (!id || seen.has(key)) return [];
        seen.add(key);
        return [{ kind, id, title: el.getAttribute("data-scope-title") ?? "" }];
      }
    );
  }, []);

  /** 캐럿 앞의 글자. `@질의`를 찾는 데만 쓴다. */
  const textBeforeCaret = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !box.current) return "";
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(box.current, 0);
    return range.toString();
  }, []);

  /**
   * 글자를 다 지우면 Chrome 이 `<br>` 을 남겨, 칩이 있을 때 빈 첫 줄이 생기고 상자가 두 줄로
   * 벌어진다. 맨 앞의 것만 지운다 — 중간의 `<br>` 은 Shift+Enter 로 넣은 줄바꿈이다.
   */
  const stripLeadingBreaks = useCallback((node: HTMLElement) => {
    while (node.firstChild?.nodeName === "BR") node.firstChild.remove();
  }, []);

  const sync = useCallback(() => {
    const node = box.current;
    if (!node) return;
    stripLeadingBreaks(node);
    setEmpty(
      node.textContent?.trim() === "" && !node.querySelector(`[${CHIP}]`)
    );
    onChipsChange(readChips());
    const found = MENTION.exec(textBeforeCaret());
    onQueryChange(found ? found[1] : null);
  }, [
    onChipsChange,
    onQueryChange,
    readChips,
    stripLeadingBreaks,
    textBeforeCaret,
  ]);

  useImperativeHandle(ref, () => ({
    read: () => ({
      // 범위는 아래 배열이 정하므로 문장의 마커가 계약을 흔들지 않는다.
      text: readSentence(box.current),
      chips: readChips(),
    }),
    clear: () => {
      if (box.current) box.current.innerHTML = "";
      setEmpty(true);
      onChipsChange([]);
      onQueryChange(null);
    },
    focus: () => box.current?.focus(),
    commitMention: (chip) => {
      const node = box.current;
      const sel = window.getSelection();
      if (!node || !sel?.rangeCount) return;

      // `execCommand` 는 폐기됐고 브라우저마다 되돌리기 스택을 다르게 건드려서 Range 로 자른다.
      const range = sel.getRangeAt(0);
      const found = MENTION.exec(textBeforeCaret());
      if (found) {
        // `@질의`만 지운다. 앞의 공백은 문장의 것이라 남긴다.
        deleteBeforeCaret(range, found[0].length - found[0].indexOf("@"));
      }

      // 칩 뒤에 공백을 둬야 다음 글자가 칩에 붙지 않는다. 둘을 한 번에 넣는다 — 따로
      // `insertNode` 하면 텍스트 노드가 쪼개져 칩과 공백 사이에 빈 노드가 낀다.
      const space = document.createTextNode(" ");
      const fragment = document.createDocumentFragment();
      fragment.append(chipElement(chip), space);
      range.insertNode(fragment);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      node.focus();
      sync();
    },
    prepend: (chip) => {
      const node = box.current;
      if (!node) return;
      node.prepend(chipElement(chip), document.createTextNode(" "));
      sync();
    },
    append: (text) => {
      const node = box.current;
      if (!node) return;
      node.append(document.createTextNode(text));
      // 캐럿을 끝으로 옮겨 바로 이어 쓸 수 있게 한다.
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      node.focus();
      sync();
    },
  }));

  return (
    <div
      ref={box}
      role="textbox"
      aria-multiline="true"
      aria-label="메시지"
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-empty={empty ? "true" : undefined}
      onInput={sync}
      onKeyUp={sync}
      onClick={sync}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        sync();
      }}
      onPaste={(event) => {
        // 서식을 들이지 않는다.
        event.preventDefault();
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const text = document.createTextNode(
          event.clipboardData.getData("text/plain").replace(/\r?\n/g, " ")
        );
        range.insertNode(text);
        range.setStartAfter(text);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        sync();
      }}
      onKeyDown={(event) => {
        // 피커가 열려 있으면 방향키·Enter·Tab 은 피커의 것이다. 피커가 먹은 키는 캡처에서
        // 끊겨 여기 안 오고, 남는 것은 조합 중이라 피커가 안 건드린 Enter 다. 줄바꿈으로
        // 처리하지 않는다.
        if (
          isPickerOpen &&
          ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(event.key)
        ) {
          event.preventDefault();
          return;
        }
        if (event.key !== "Enter" || event.shiftKey) return;
        // 조합 중이면 이 Enter 는 확정이지 전송이 아니다. `isComposing` 만 보면
        // 일부 브라우저에서 새는 것이 알려져 있어 둘 다 본다.
        if (composing.current || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        // `pre-wrap` 이어야 칩 뒤 공백과 연속 공백이 보인다. 한 줄 높이를 보내기 버튼(36px)에
        // 맞춘다: 15px × 1.75 + 위아래 5px.
        "relative max-h-[10.5rem] min-h-[2.25rem] flex-1 overflow-y-auto py-[5px] text-[15px] leading-[1.75] whitespace-pre-wrap outline-none",
        // 플레이스홀더는 흐름 밖에 둔다. 흐름 안이면 빈 편집기의 캐럿이 문구 뒤로 밀린다.
        // `inset-y` 로 늘이면 문구가 자기 줄을 벗어나므로 첫 줄과 같은 자리·줄 높이에 둔다.
        "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:absolute",
        "data-[empty=true]:before:top-[5px] data-[empty=true]:before:left-0",
        "data-[empty=true]:before:leading-[1.75]",
        "data-[empty=true]:before:text-[var(--el-muted)]",
        "data-[empty=true]:before:content-[attr(data-placeholder)]",
        disabled && "opacity-60"
      )}
    />
  );
}
