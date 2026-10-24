"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";

import { scopeKey, type ScopeChip } from "@/lib/chat/scope-chip";
import { scopeMarker } from "@/lib/chat/scope-marker";
import { cn } from "@/lib/utils";

/**
 * 질문을 쓰는 입력. 범위(칩)는 문장 안이 아니라 입력창 아래 줄에 선다(APP-1436) — 이 편집기는 칩 목록을 들고 있을 뿐 그리지
 * 않고, 그리는 것은 컴포저다. `@` 를 치면 피커가 열리고, 고르면 `@질의` 가 문장에서 빠지고 칩이 목록에 붙는다.
 *
 * `contenteditable` 인 것은 붙여넣기를 평문으로 받고 한 줄로 시작해 `max-height` 안에서 자라게 하려는 것이다.
 *
 * 범위를 정하는 것은 `noteIds`·`projectIds` 배열이다. 보내는 문장 맨 앞에는 칩마다 마커(`@[제목](noteId:…)`)를 붙인다 —
 * 말풍선이 그 자리에 칩을 그리고 누르면 그 회의록으로 간다. 규칙은 `scope-marker.ts`.
 */

export type MentionHandle = {
  /** 지금 편집기가 들고 있는 것. 전송 직전에 읽는다. 문장은 칩 마커 + 쓴 글이다. */
  read: () => { text: string; chips: ScopeChip[] };
  clear: () => void;
  focus: () => void;
  /** 캐럿 앞의 `@질의`를 지우고 칩을 붙인다. 피커가 고른 뒤 부른다. */
  commitMention: (chip: ScopeChip) => void;
  /** 칩을 맨 앞에 붙인다. 회의록 프리필·되돌린 문장이 쓴다. 이미 있으면 그대로다. */
  prepend: (chip: ScopeChip) => void;
  /** 문장 끝에 글자를 붙인다. 추천 질문이 쓴다 — 칩은 그대로 둔다. */
  append: (text: string) => void;
  /**
   * 캐럿 자리(편집기 밖이면 문장 끝)에 `@` 를 넣어 피커를 연다. 「회의록」 버튼이 쓴다 — `@` 를 쳐야 목록이 뜬다는 것을 모르는
   * 사람의 입구다. 앞 글자에 붙으면 질의로 안 읽히므로 그때는 공백을 하나 둔다. 넣은 `@` 는 고르면(`commitMention`) 지워지고,
   * 고르지 않고 닫으면(`cancelMention`) 이 버튼이 넣은 것만 지운다 — 넣는 곳과 빼는 곳이 이 파일 하나다.
   */
  startMention: () => void;
  /** 피커를 고르지 않고 닫았다. 「회의록」 버튼이 넣고 아무것도 안 친 `@` 만 걷는다. 손으로 친 `@` 는 둔다. */
  cancelMention: () => void;
  /** 칩 하나를 뗀다. 칩의 ✕ 가 쓴다. */
  removeChip: (chip: ScopeChip) => void;
  /** 붙은 칩을 다 뗀다. 문장은 남는다. */
  removeChips: () => void;
};

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

/** 편집기가 든 글. `<br>` 은 안 세고, 나머지는 `textContent` 와 같다. */
function readSentence(root: HTMLElement | null) {
  return (root?.textContent ?? "").trim();
}

/** 편집기 끝에 캐럿을 둔다. 선택이 편집기 밖에 있거나 사라졌을 때(터치로 목록을 누른 뒤 등) 쓴다. */
function caretAtEnd(node: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  return range;
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
  shortPlaceholder,
  disabled,
  isPickerOpen,
  pickerId,
  activeOptionId,
  onQueryChange,
  onChipsChange,
  onSubmit,
}: {
  ref: React.RefObject<MentionHandle | null>;
  placeholder: string;
  /** 좁은 폭(컴포저가 약 22rem 아래)에서 쓰는 짧은 안내. 없으면 긴 것을 쓴다. */
  shortPlaceholder?: string;
  disabled?: boolean;
  /** `@` 피커가 열려 있다. 그동안 Enter 는 피커의 것이다. */
  isPickerOpen?: boolean;
  /** 피커 목록 상자의 id. 열려 있는 동안 `aria-controls` 로 잇는다. */
  pickerId?: string;
  /** 피커에서 겨눈 항목. 포커스는 여기 남으므로 `aria-activedescendant` 로 알린다. */
  activeOptionId?: string | null;
  /** 캐럿 앞의 `@질의`. 없으면 `null` — 피커를 닫으라는 뜻이다. */
  onQueryChange: (query: string | null) => void;
  onChipsChange: (chips: ScopeChip[]) => void;
  onSubmit: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const [empty, setEmpty] = useState(true);
  /** 붙은 칩. 렌더를 기다리지 않고 바로 읽혀야 해서(되돌리기가 넣자마자 읽는다) ref 가 원본이다. */
  const chipsRef = useRef<ScopeChip[]>([]);
  /** 「회의록」 버튼이 넣은 `@` 글자 노드. 고르지 않고 닫으면 이것만 걷는다. */
  const insertedRef = useRef<Text | null>(null);

  const setChips = useCallback(
    (next: ScopeChip[]) => {
      chipsRef.current = next;
      onChipsChange(next);
    },
    [onChipsChange]
  );

  /** 캐럿 앞의 글자. `@질의`를 찾는 데만 쓴다. 캐럿이 편집기 밖이면 null 이다. */
  const textBeforeCaret = useCallback(() => {
    const sel = window.getSelection();
    const node = box.current;
    if (!sel?.rangeCount || !node) return null;
    const caret = sel.getRangeAt(0);
    if (!node.contains(caret.startContainer)) return null;
    const range = caret.cloneRange();
    range.setStart(node, 0);
    return range.toString();
  }, []);

  /**
   * 글자를 다 지우면 Chrome 이 `<br>` 을 남긴다. 맨 앞의 것만 지운다 — 중간의 `<br>` 은 Shift+Enter 로 넣은 줄바꿈이다.
   * 남겨 두면 빈 편집기에 빈 첫 줄이 생겨 캐럿이 한 줄 아래·플레이스홀더와 다른 자리에 선다.
   */
  const stripLeadingBreaks = useCallback((node: HTMLElement) => {
    while (node.firstChild?.nodeName === "BR") node.firstChild.remove();
  }, []);

  const sync = useCallback(() => {
    const node = box.current;
    if (!node) return;
    stripLeadingBreaks(node);
    const isEmpty = node.textContent === "";
    // 비었으면 남은 빈 노드를 다 걷는다. 빈 텍스트 노드나 `<br>` 이 남으면 캐럿이 플레이스홀더 첫 글자 자리를 벗어난다
    if (isEmpty && node.childNodes.length > 0) node.replaceChildren();
    setEmpty(isEmpty);
    const before = textBeforeCaret();
    const found = before === null ? null : MENTION.exec(before);
    onQueryChange(found ? found[1] : null);
  }, [onQueryChange, stripLeadingBreaks, textBeforeCaret]);

  /** 캐럿 앞(없으면 문장 끝)의 `@질의` 를 지운다. 지웠으면 true. */
  const dropMentionQuery = useCallback(() => {
    const node = box.current;
    if (!node) return false;
    const sel = window.getSelection();
    const before = textBeforeCaret();
    // 터치로 목록을 누르면 선택이 편집기를 떠날 수 있다. 그때는 문장 끝에서 찾는다(「회의록」 버튼은 끝에 `@` 를 넣는다)
    const range =
      before !== null && sel?.rangeCount ? sel.getRangeAt(0) : caretAtEnd(node);
    const found = MENTION.exec(before ?? node.textContent ?? "");
    if (!found) return false;
    // `@질의`만 지운다. 앞의 공백은 문장의 것이라 남긴다.
    deleteBeforeCaret(range, found[0].length - found[0].indexOf("@"));
    return true;
  }, [textBeforeCaret]);

  const placeCaret = useCallback((range: Range) => {
    const node = box.current;
    if (!node) return;
    node.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  useImperativeHandle(ref, () => ({
    read: () => {
      const sentence = readSentence(box.current);
      const markers = chipsRef.current.map(scopeMarker).join(" ");
      return {
        // 범위는 아래 배열이 정한다. 마커는 말풍선이 칩을 그릴 자리다
        text: [markers, sentence].filter(Boolean).join(" "),
        chips: chipsRef.current,
      };
    },
    clear: () => {
      if (box.current) box.current.replaceChildren();
      insertedRef.current = null;
      setEmpty(true);
      setChips([]);
      onQueryChange(null);
    },
    focus: () => {
      const node = box.current;
      if (!node) return;
      // 캐럿이 이미 안에 있으면 그대로 둔다. 밖에서 들어오면 문장 끝에 선다(빈 편집기면 첫 글자 자리다)
      if (textBeforeCaret() === null) placeCaret(caretAtEnd(node));
      else node.focus();
    },
    commitMention: (chip) => {
      const node = box.current;
      if (!node) return;
      dropMentionQuery();
      insertedRef.current = null;
      if (!chipsRef.current.some((each) => scopeKey(each) === scopeKey(chip)))
        setChips([...chipsRef.current, chip]);
      // 지운 자리(없으면 끝)에 캐럿을 두고 이어 쓴다
      const sel = window.getSelection();
      const inside = textBeforeCaret() !== null;
      placeCaret(
        inside && sel?.rangeCount ? sel.getRangeAt(0) : caretAtEnd(node)
      );
      sync();
    },
    prepend: (chip) => {
      if (chipsRef.current.some((each) => scopeKey(each) === scopeKey(chip)))
        return;
      setChips([chip, ...chipsRef.current]);
    },
    startMention: () => {
      const node = box.current;
      if (!node) return;
      const before = textBeforeCaret();
      const sel = window.getSelection();
      const range =
        before !== null && sel?.rangeCount
          ? sel.getRangeAt(0)
          : caretAtEnd(node);
      range.deleteContents();
      const lead =
        (before ?? node.textContent ?? "") === "" ||
        /\s$/.test(before ?? node.textContent ?? "")
          ? ""
          : " ";
      const text = document.createTextNode(`${lead}@`);
      range.insertNode(text);
      insertedRef.current = text;
      // 캐럿은 새 범위로 세운다. 선택의 범위를 고쳐 다시 넣으면 엔진에 따라 맨 앞으로 돌아간다
      const caret = document.createRange();
      caret.setStartAfter(text);
      caret.collapse(true);
      placeCaret(caret);
      sync();
    },
    cancelMention: () => {
      const inserted = insertedRef.current;
      insertedRef.current = null;
      // 버튼이 넣은 그대로(질의를 안 쳤다)일 때만 걷는다
      if (inserted?.isConnected && /^\s?@$/.test(inserted.data)) {
        inserted.remove();
        sync();
      }
    },
    removeChip: (chip) => {
      setChips(
        chipsRef.current.filter((each) => scopeKey(each) !== scopeKey(chip))
      );
    },
    removeChips: () => setChips([]),
    append: (text) => {
      const node = box.current;
      if (!node) return;
      node.append(document.createTextNode(text));
      // 캐럿을 끝으로 옮겨 바로 이어 쓸 수 있게 한다.
      placeCaret(caretAtEnd(node));
      sync();
    },
  }));

  return (
    <div
      ref={box}
      role="textbox"
      aria-multiline="true"
      aria-label="메시지"
      aria-autocomplete="list"
      aria-controls={isPickerOpen ? pickerId : undefined}
      aria-activedescendant={
        isPickerOpen ? (activeOptionId ?? undefined) : undefined
      }
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-placeholder-short={shortPlaceholder ?? placeholder}
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
        // 빈 문장에서 백스페이스는 마지막 칩을 뗀다 — 칩이 입력 밖에 있어도 손에 익은 대로 지워진다
        if (
          event.key === "Backspace" &&
          !composing.current &&
          box.current?.textContent === "" &&
          chipsRef.current.length > 0
        ) {
          event.preventDefault();
          setChips(chipsRef.current.slice(0, -1));
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
        // `pre-wrap` 이어야 연속 공백이 보인다. 한 줄 높이는 15px × 1.75 + 위아래 5px 이다.
        "relative max-h-[10.5rem] min-h-[2.25rem] min-w-0 flex-1 overflow-y-auto py-[5px] text-left text-[15px] leading-[1.75] whitespace-pre-wrap outline-none",
        // 플레이스홀더는 흐름 밖에 둔다. 흐름 안이면 빈 편집기의 캐럿이 문구 뒤로 밀린다. 한 줄로 자르되(넘치면 말줄임)
        // 좁은 폭에서는 짧은 문구를 쓴다 — 잘린 안내는 문장이 끊겨 읽힌다.
        "data-[empty=true]:before:pointer-events-none data-[empty=true]:before:absolute",
        "data-[empty=true]:before:top-[5px] data-[empty=true]:before:right-0 data-[empty=true]:before:left-0",
        "data-[empty=true]:before:truncate data-[empty=true]:before:leading-[1.75]",
        "data-[empty=true]:before:text-[var(--el-muted)]",
        "data-[empty=true]:before:content-[attr(data-placeholder)]",
        "@max-[22rem]:data-[empty=true]:before:content-[attr(data-placeholder-short)]",
        disabled && "opacity-60"
      )}
    />
  );
}
