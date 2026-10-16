"use client";

import { Mail, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import {
  addRecipients,
  hasRecipient,
  isEmail,
  matchCandidates,
  removeRecipient,
  splitAddresses,
  type Recipient,
  type RecipientCandidate,
} from "@/lib/notes/share-mail/recipients";
import { cn } from "@/lib/utils";

export type RecipientGroup = { label: string; people: readonly RecipientCandidate[] };

type Option = { person: RecipientCandidate; typed?: boolean };

/**
 * 이메일 주소 칩 입력 + 후보 목록(combobox). 쉼표 · 세미콜론 · Enter · Tab · 포커스 이탈에서 칩이 서고,
 * 여러 주소를 붙여 넣으면 한 번에 나뉜다. 규칙은 `lib/notes/share-mail/recipients` 가 갖고 여기는 키와
 * 포커스만 다룬다.
 *
 * 후보는 [groups] 차례대로(예: 회의 참석자 → 워크스페이스 멤버) 묶어 보이고, 후보에 없는 올바른 주소를
 * 치면 「직접 입력」 한 줄이 붙는다.
 */
/** 화살표 · 마우스로 고르기 전, 친 글에 따라 정하는 후보 자리 */
const AUTO = -2;

export function EmailRecipientsInput({
  id,
  value,
  onChange,
  groups,
  disabled,
  invalid,
  describedBy,
  placeholder = "이름이나 이메일을 입력하세요",
}: {
  id: string;
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  groups: readonly RecipientGroup[];
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // 칩을 뺀 뒤 입력칸으로 포커스를 돌려줄 때는 후보 목록을 열지 않는다 — 빼기는 고르기가 아니라서
  // 목록이 아래 내용을 덮으면 안 된다
  const quietFocus = useRef(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const candidates = groups.flatMap((group) => group.people);
  const shown = groups
    .map((group) => ({ label: group.label, people: matchCandidates(group.people, value, query) }))
    .filter((group) => group.people.length > 0)
    .map((group, i, all) => ({
      ...group,
      // 목록 전체에서 이 묶음의 첫 후보가 몇 번째인가 — 화살표 키와 aria-activedescendant 가 이 번호를 쓴다
      start: all.slice(0, i).reduce((sum, prev) => sum + prev.people.length, 0),
    }));
  const options: Option[] = shown.flatMap((group) => group.people.map((person) => ({ person })));
  const typed = query.trim();
  if (
    isEmail(typed) &&
    !hasRecipient(value, typed) &&
    !hasRecipient(options.map((o) => o.person), typed)
  ) {
    options.push({ person: { name: "", email: typed }, typed: true });
  }
  const expanded = open && options.length > 0;
  // 치는 동안 고르는 후보. **다 친 주소면 그 주소다** — 첫 후보를 고르면 `john@example.co` 를 치고 Enter 를 눌러도
  // 후보의 `john@example.com` 이 들어가, 회의록이 엉뚱한 사람에게 갔다. 이름 · 주소 일부면 첫 후보다
  const exact = options.findIndex((option) => option.person.email.toLowerCase() === typed.toLowerCase());
  const autoIndex = !typed ? -1 : isEmail(typed) ? exact : 0;
  const activeIndex = active === AUTO ? autoIndex : active < options.length ? active : options.length - 1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  // 화살표로 고른 후보를 목록 안에 보이게 한다 — 포커스는 입력칸에 있어 브라우저가 대신 스크롤해 주지 않는다.
  // 보이지 않는 사람을 고른 채 Enter 를 누르게 되면 안 된다
  useEffect(() => {
    if (!expanded || activeIndex < 0) return;
    document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [expanded, activeIndex, listId]);

  const commitText = (text: string) => {
    const parts = splitAddresses(text);
    if (parts.length) onChange(addRecipients(value, parts, candidates));
    setQuery("");
    setActive(-1);
  };

  const choose = (option: Option) => {
    onChange(addRecipients(value, [option.typed ? option.person.email : option.person], candidates));
    setQuery("");
    setActive(-1);
  };

  const remove = (email: string) => {
    onChange(removeRecipient(value, email));
    setOpen(false);
    quietFocus.current = true;
    inputRef.current?.focus();
    quietFocus.current = false;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter 는 조합을 끝내는 키다. 여기서 칩을 세우면 마지막 글자가 떨어진다
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!options.length) return;
        event.preventDefault();
        setOpen(true);
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((activeIndex + step + options.length) % options.length);
        return;
      }
      case "Enter":
      case "Tab":
        if (expanded && activeIndex >= 0) {
          event.preventDefault();
          choose(options[activeIndex]);
        } else if (typed) {
          event.preventDefault();
          commitText(query);
        }
        return;
      case "Backspace":
        if (!query && value.length) {
          event.preventDefault();
          onChange(value.slice(0, -1));
          setOpen(false);
        }
        return;
      case "Escape":
        // 목록만 닫는다. 열린 목록이 없을 때만 대화상자가 Esc 를 받는다
        if (expanded) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-block border border-[var(--el-hairline-strong)] bg-transparent px-2 py-1.5 transition-colors focus-within:border-[var(--el-ink)]",
          invalid && "border-[var(--el-error)] focus-within:border-[var(--el-error)]",
          disabled && "pointer-events-none opacity-60"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((recipient) => {
          const label = recipient.name || recipient.email;
          return (
            <span
              key={recipient.email.toLowerCase()}
              data-invalid={recipient.valid ? undefined : ""}
              title={recipient.email}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--el-canvas-soft)] py-0.5 pr-0.5 pl-2.5 text-[13px] text-[var(--el-ink)]",
                !recipient.valid &&
                  "bg-[var(--el-error)]/[0.08] text-[var(--el-error)] ring-1 ring-[var(--el-error)] ring-inset"
              )}
            >
              <span className="truncate">{label}</span>
              {recipient.valid ? null : <span className="sr-only">(주소 형식 오류)</span>}
              <button
                type="button"
                aria-label={`${label} 빼기`}
                disabled={disabled}
                className="grid size-5 shrink-0 place-items-center rounded-full opacity-70 hover:bg-[var(--el-ink)]/10 hover:opacity-100"
                // 누르는 순간 입력칸 포커스가 빠지면 blur 가 칩을 다시 그려 누른 버튼이 사라지고 클릭이 삼켜진다
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  remove(recipient.email);
                }}
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="email"
          autoComplete="off"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          placeholder={value.length ? undefined : placeholder}
          className="min-w-[8.75rem] flex-1 bg-transparent px-0.5 py-1 text-base outline-none placeholder:text-[var(--el-muted)] md:text-sm"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            // 쉼표 · 세미콜론을 치면 그 앞까지가 받는 사람이다
            if (/[,;]/.test(next)) {
              commitText(next);
              return;
            }
            setQuery(next);
            setOpen(true);
            setActive(AUTO);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!/[\s,;]/.test(text.trim())) return;
            event.preventDefault();
            // 고른 글자는 붙여 넣은 글로 바뀐다 — 앞에 쳐 둔 주소를 통째로 골라 붙여 넣었는데 옛 주소까지 들어갔다
            const { selectionStart, selectionEnd } = event.currentTarget;
            const start = selectionStart ?? query.length;
            // 원문 그대로 바꿔 끼운다 — 사이에 빈칸을 넣으면 `alice@old.com` 의 도메인만 바꿔 붙일 때 주소가 둘로 갈렸다
            commitText(query.slice(0, start) + text + query.slice(selectionEnd ?? start));
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (!quietFocus.current) setOpen(true);
          }}
          onBlur={() => {
            if (typed) commitText(query);
            setOpen(false);
          }}
        />
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="받는 사람 후보"
        hidden={!expanded}
        className="absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-64 overflow-y-auto rounded-block border border-[var(--el-hairline)] bg-popover p-1.5 shadow-e3"
      >
        {shown.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <div role="presentation" className="px-2.5 pt-2 pb-1 text-[11.5px] text-[var(--el-muted)]">
              {group.label}
            </div>
            {group.people.map((person, i) => {
              const at = group.start + i;
              return (
                <OptionRow
                  key={person.email}
                  id={optionId(at)}
                  selected={at === activeIndex}
                  onPick={() => choose({ person })}
                  onHover={() => setActive(at)}
                  icon={<PersonAvatar name={person.email} size={26} />}
                  title={person.name}
                  detail={person.email}
                />
              );
            })}
          </div>
        ))}
        {options.at(-1)?.typed ? (
          <div role="group" aria-label="직접 입력">
            <div role="presentation" className="px-2.5 pt-2 pb-1 text-[11.5px] text-[var(--el-muted)]">
              직접 입력
            </div>
            <OptionRow
              id={optionId(options.length - 1)}
              selected={activeIndex === options.length - 1}
              onPick={() => choose(options[options.length - 1])}
              onHover={() => setActive(options.length - 1)}
              icon={
                <span className="grid size-[26px] place-items-center rounded-full bg-[var(--el-canvas-soft)]">
                  <Mail className="size-3.5" aria-hidden />
                </span>
              }
              title={typed}
              detail="이 주소로 보내기"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OptionRow({
  id,
  selected,
  onPick,
  onHover,
  icon,
  title,
  detail,
}: {
  id: string;
  selected: boolean;
  onPick: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 aria-selected:bg-[var(--el-canvas-soft)]"
      // mousedown 은 입력칸의 포커스만 붙든다 — blur 가 목록을 닫으면 클릭이 닿지 않는다. 고르기는 click 에서 한다:
      // 스크린 리더는 click 만 보내고, mousedown 에서 고르면 오른쪽 클릭에도 받는 사람이 들어갔다
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      onMouseMove={onHover}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-[var(--el-ink)]">{title}</span>
        <span className="block truncate text-xs text-[var(--el-muted)]">{detail}</span>
      </span>
    </div>
  );
}
