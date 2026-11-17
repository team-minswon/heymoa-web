"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import { scopeMarker } from "@/lib/chat/scope-marker";
import { cn } from "@/lib/utils";

export type MentionHandle = {
  read: () => { text: string; chips: ScopeChip[] };
  clear: () => void;
  focus: () => void;
  commitMention: (chip: ScopeChip) => void;
  prepend: (chip: ScopeChip) => void;
  remove: (chip: ScopeChip) => void;
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

function iconElement(kind: ScopeChip["kind"]) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "mt-[2px] size-3.5 shrink-0 self-start");
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
  el.className = scopeChipClass(chip.kind, { extra: "[word-break:keep-all]" });
  const icon = iconElement(chip.kind);
  const label = document.createElement("span");
  label.textContent = chip.title;
  el.append(icon, label);
  return el;
}

function deleteBeforeCaret(range: Range, count: number) {
  let remaining = count;
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

    const parent = text.parentNode;
    if (!parent) break;
    range.setStart(parent, [...parent.childNodes].indexOf(text));
  }
  range.collapse(true);
}

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
  isPickerOpen?: boolean;
  onQueryChange: (query: string | null) => void;
  onChipsChange: (chips: ScopeChip[]) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("chat.composer");
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
      const space = document.createTextNode(" ");
      node.prepend(chipElement(chip), space);
      const sel = window.getSelection();
      if (sel?.rangeCount && node.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const after = document.createRange();
        after.setStartAfter(space);
        if (range.compareBoundaryPoints(Range.START_TO_START, after) < 0) {
          after.collapse(true);
          sel.removeAllRanges();
          sel.addRange(after);
        }
      }
      sync();
    },
    remove: (chip) => {
      const node = box.current;
      if (!node) return;
      node.querySelectorAll(`[${CHIP}]`).forEach((el) => {
        if (
          el.getAttribute(CHIP) !== chip.kind ||
          el.getAttribute("data-scope-id") !== chip.id
        )
          return;
        const next = el.nextSibling;
        if (
          next?.nodeType === Node.TEXT_NODE &&
          next.nodeValue?.startsWith(" ")
        )
          (next as Text).deleteData(0, 1);
        el.remove();
      });
      sync();
    },
    append: (text) => {
      const node = box.current;
      if (!node) return;
      node.append(document.createTextNode(text));
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
      aria-label={t("message")}
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
        "relative max-h-[10.5rem] min-h-[2.25rem] flex-1 overflow-y-auto py-[5px] text-[15px] leading-[1.75] whitespace-pre-wrap outline-none",
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
