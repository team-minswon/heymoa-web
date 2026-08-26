"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";

import type { ScopeChip } from "@/lib/chat/scope-chip";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import { scopeMarker } from "@/lib/chat/scope-marker";
import { cn } from "@/lib/utils";

/**
 * 칩이 **문장 안에** 사는 입력.
 *
 * 칩을 입력 밖 별도 줄에 두면 「무엇을 붙였나」와 「무엇을 쓰고 있나」가 두 덩어리로 갈립니다.
 * 여기서는 `@`를 친 자리에 칩이 그대로 박혀서, **문장이 곧 이번 요청**입니다 —
 * 「이 @회의록 에서 정한 게 뭐야」처럼 읽힙니다.
 *
 * ### 왜 textarea 가 아닌가
 *
 * `textarea`는 문자열만 담습니다. 문장 중간에 지울 수 없는 덩어리를 넣으려면 요소가
 * 필요하고, 그건 `contenteditable`뿐입니다. 대신 브라우저가 주는 것을 그대로 쓰지 않고
 * 셋을 붙잡습니다.
 *
 * - **칩은 원자다.** `contenteditable="false"`라 캐럿이 안으로 못 들어가고, 백스페이스 한
 *   번에 통째로 지워집니다. 절반만 남는 칩이 없습니다.
 * - **서식이 안 들어온다.** 붙여넣기를 가로채 평문만 넣습니다. 안 그러면 남의 글에서
 *   따온 색·굵기가 그대로 실립니다.
 * - **한 줄로 시작해서 자란다.** `max-height` 안에서 스크롤합니다.
 *
 * ### 계약과의 관계
 *
 * 범위를 정하는 것은 `noteIds`·`projectIds` 배열입니다. 같은 회의록을 두 번 박아도
 * 배열에는 한 번만 실립니다 — 추출할 때 접습니다.
 *
 * 문장에는 칩이 **마커**로 실립니다(`@[주간 회의](noteId:…)`) — 배열을 대신하는 것이
 * 아니라 「문장의 이 자리가 그중 무엇을 가리키나」를 덧붙이는 것입니다.
 * 규칙은 `lib/chat/scope-marker.ts`.
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
 * 피커가 쓰는 lucide `Folder`·`FileText` 의 path 를 그대로 옮긴 것.
 *
 * **컴포넌트를 못 부른다** — 칩은 React 밖에서 만드는 DOM 노드다(편집기가 자기 내용을
 * 스스로 들기 때문에). 목록과 칩의 아이콘이 다르면 「이걸 골랐다」가 안 이어져서,
 * 모양을 맞추려고 경로만 가져온다. lucide 버전이 오르면 여기도 같이 본다.
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
  // **줄 높이보다 낮게 잡는다.** 편집기의 `leading` 을 그대로 물려받으면 칩이 줄 상자보다
  // 커져서(30px vs 26.25px) 줄 밖으로 삐져나오고, 그 옆의 캐럿은 줄 높이라 칩보다 짧다 —
  // 둘의 위아래가 안 맞아 커서가 엉뚱한 데 서 있는 것처럼 보인다. 그 값은
  // `scopeChipClass` 가 든다 — 말풍선의 칩과 한 벌이어야 해서다. **이제 갈라지는 것이
  // 하나도 없다**(바탕까지 같다). 이유는 그 파일에 적혀 있다.
  //
  // 여기서 더하는 것은 **입력에서만 필요한 상한**이다. 긴 제목이 상자를 다 먹으면 쓰던
  // 문장이 안 보인다. 말풍선에는 이 상한이 없다 — 이미 보낸 문장이라 제목이 온전히 보여야
  // 무엇을 물었는지 읽힌다.
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
 * 캐럿 앞 `count` 글자를 지운다.
 *
 * **텍스트 노드 하나로 가정하면 안 된다.** 캐럿은 노드 사이(요소 컨테이너)에도 서고,
 * 한글을 치다 보면 텍스트 노드가 여러 개로 갈리기도 한다. 그때 한 노드만 보고 자르면
 * `@질의`가 남고, 남으면 피커가 다시 열려 칩이 두 번 박힌다.
 *
 * 칩(원자 노드)을 만나면 멈춘다 — `@질의`는 텍스트뿐이라 거기까지 갈 일이 없다.
 */
function deleteBeforeCaret(range: Range, count: number) {
  let remaining = count;
  // 노드 경계를 넘을 때마다 한 바퀴 돈다. 문장 길이를 넘게 돌 일은 없지만 상한을 둔다.
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
 * 편집기가 든 문장. 칩은 **마커**로 낸다 — `@[주간 회의](noteId:…)`.
 *
 * 한때 `textContent` 를 그냥 읽어서 칩이 맨살 제목으로 나갔다. 그러면 id 도 구분자도
 * 안 실려서 **문장이 문자열로만 이어진다** — 말풍선은 제목을 정규식으로 되찾아야 하고,
 * 되찾은 칩에는 id 가 없어 누를 수도 없고, 동명 회의록은 아예 안 갈린다.
 *
 * **`textContent` 를 못 쓴다.** 칩 안의 라벨까지 평평하게 이어 붙이기 때문이다. 대신
 * 자식을 훑으면서 칩만 바꿔치기한다 — 나머지 규칙(`<br>` 은 안 세고 SVG 는 글자가 없다)은
 * `textContent` 와 똑같이 둔다. 여기서 줄바꿈 규칙까지 바꾸면 이번 변경과 무관한 것이
 * 같이 움직인다.
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
 * `@` 뒤에 이어지는 질의.
 *
 * **공백에서 끊지 않는다.** 회의록 제목은 「알림 정책 논의」처럼 거의 다 여러 낱말이라,
 * 공백에서 끊으면 두 번째 낱말을 치는 순간 피커가 닫힌다. 그 닫힌 자리에서 고르려고 누른
 * Enter 는 **그대로 전송**이 된다 — 반쯤 쓴 문장이 나간다.
 *
 * 그럼 언제 끝나나. **맞는 것이 없을 때**다. 그 판정은 후보 목록을 든 컴포저가 한다
 * (`matchScope`) — 여기서는 `@` 뒤의 글자만 넘긴다. 줄바꿈과 다음 `@` 만 경계다.
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
  /**
   * `@` 피커가 열려 있다. **그동안 Enter 는 피커의 것**이다 — 고르려던 Enter 가
   * 그대로 전송되면 반쯤 쓴 문장이 나간다.
   */
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
        // 같은 것을 두 번 박아도 배열에는 한 번이다.
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
   * 브라우저가 지우기 뒤에 남기는 자리표시를 걷어낸다.
   *
   * 글자를 다 지우면 Chrome 이 `<br>` 을 하나 남긴다. 칩이 아직 있으면 편집기가 비지
   * 않았으므로 그 `<br>` 이 **빈 첫 줄**을 만들고, 칩이 둘째 줄로 밀려 상자가 두 줄
   * 높이로 벌어진다.
   *
   * **맨 앞의 것만 지운다.** 앞에 아무것도 없는 줄바꿈은 사용자가 넣었을 수 없다 —
   * 내릴 것이 없기 때문이다. 문장 중간의 `<br>` 은 Shift+Enter 로 넣은 진짜 줄바꿈이라
   * 그대로 둔다.
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
      // 칩이 마커로 문장에 남는다 — 제목과 id 가 함께다. 범위 자체는 아래 배열이
      // 정하므로 이 문자열이 계약을 흔들지 않는다.
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

      // **`execCommand` 를 안 쓴다.** 폐기된 API 이고 브라우저마다 되돌리기 스택을 다르게
      // 건드립니다. `@질의`가 공백을 못 갖는 덕에 Range 로 정확히 잘라낼 수 있습니다.
      const range = sel.getRangeAt(0);
      const found = MENTION.exec(textBeforeCaret());
      if (found) {
        // `@질의`만 지운다. 앞의 공백은 문장의 것이라 남긴다.
        deleteBeforeCaret(range, found[0].length - found[0].indexOf("@"));
      }

      // 칩 뒤에 공백을 둔다 — 없으면 다음 글자가 칩에 딱 붙는다. 편집기가
      // `whitespace-pre-wrap` 이라 이 공백이 화면에도 보이고, 캐럿이 그 뒤에 선다.
      //
      // 둘을 **한 번에** 넣는다. 따로 `insertNode` 하면 그때마다 캐럿이 있던 텍스트
      // 노드가 쪼개져서 칩과 공백 사이에 빈 노드가 낀다.
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
        // 서식을 들이지 않는다. 남의 글에서 따온 색·굵기가 그대로 실린다.
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
        // 피커가 열려 있으면 방향키·Enter·Tab 은 피커의 것이다.
        //
        // **먹은 키는 여기까지 안 온다** — 피커가 캡처 단계에서 전파를 끊는다. 여기 남는
        // 것은 피커가 조합 중이라 손대지 않은 Enter뿐이고, 그건 편집기가 줄바꿈으로
        // 처리해서는 안 된다. 조합이 끝나면 그때 한 번 더 눌러 고른다.
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
        // **`pre-wrap` 이 있어야 칩 뒤 공백이 보인다.** 기본 `normal` 은 끝 공백을
        // 안 그려서, 칩을 넣고 나면 캐럿이 칩에 딱 붙은 것처럼 보인다 — 다음 글자가
        // 칩 안으로 들어가는 줄 안다. 문장 중간의 연속 공백도 이걸로 살아남는다.
        // 한 줄일 때 높이가 보내기 버튼(36px)과 같아지게 잡는다 — 상자가 `items-end` 라
        // 둘이 같아야 빈 상태에서 위아래가 고르게 남는다. 15px × 1.75 = 26.25px 에
        // 위아래 5px 을 더해 36.25px.
        "relative max-h-[10.5rem] min-h-[2.25rem] flex-1 overflow-y-auto py-[5px] text-[15px] leading-[1.75] whitespace-pre-wrap outline-none",
        // **플레이스홀더는 흐름 밖에 둔다.** `::before` 를 그냥 두면 그것도 한 줄의
        // 내용이라, 빈 편집기의 캐럿이 그 **뒤**로 밀려 문구 끝에 가서 선다.
        //
        // 위아래를 함께 붙이지 않는다(`inset-y`). 그러면 pseudo 상자가 편집기 높이만큼
        // 늘어나 문구가 자기 줄이 아닌 데 떠서, 빈 상자가 찌그러져 보인다.
        // 첫 줄과 **같은 자리·같은 줄 높이**에 둔다.
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
