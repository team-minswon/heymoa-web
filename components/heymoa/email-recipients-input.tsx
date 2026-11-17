"use client";

import { Mail, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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

const AUTO = -2;

export function EmailRecipientsInput({
  id,
  value,
  onChange,
  groups,
  disabled,
  invalid,
  describedBy,
  placeholder,
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
  const t = useTranslations("common.recipients");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
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
  const exact = options.findIndex((option) => option.person.email.toLowerCase() === typed.toLowerCase());
  const autoIndex = !typed ? -1 : isEmail(typed) ? exact : 0;
  const activeIndex = active === AUTO ? autoIndex : active < options.length ? active : options.length - 1;
  const optionId = (index: number) => `${listId}-option-${index}`;

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
              {recipient.valid ? null : <span className="sr-only">{t("invalid")}</span>}
              <button
                type="button"
                aria-label={t("remove", { label })}
                disabled={disabled}
                className="grid size-5 shrink-0 place-items-center rounded-full opacity-70 hover:bg-[var(--el-ink)]/10 hover:opacity-100"
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
          placeholder={value.length ? undefined : (placeholder ?? t("placeholder"))}
          className="min-w-[8.75rem] flex-1 bg-transparent px-0.5 py-1 text-base outline-none placeholder:text-[var(--el-muted)] md:text-sm"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
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
            const { selectionStart, selectionEnd } = event.currentTarget;
            const start = selectionStart ?? query.length;
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
        aria-label={t("candidates")}
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
          <div role="group" aria-label={t("typed")}>
            <div role="presentation" className="px-2.5 pt-2 pb-1 text-[11.5px] text-[var(--el-muted)]">
              {t("typed")}
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
              detail={t("sendTo")}
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
      className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 hover:bg-[var(--el-surface-strong)]/55 aria-selected:bg-[var(--el-surface-strong)]"
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
