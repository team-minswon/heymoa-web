"use client";

import { useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/ui/toast";

export const PERSON_NAME_MAX_LENGTH = 30;

export function RenamePersonDialog({
  avatarKey,
  image,
  currentName,
  secondary,
  label,
  initialValue,
  placeholder,
  hint,
  allowEmpty = false,
  onSubmit,
  onClose,
}: {
  avatarKey: string;
  image?: string | null;
  currentName: string;
  secondary?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  hint?: string;
  allowEmpty?: boolean;
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations("settings.renameDialog");
  const tActions = useTranslations("common.actions");
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closed = useRef(false);

  function close() {
    closed.current = true;
    onClose();
  }
  const trimmed = value.trim();
  const unchanged = trimmed === initialValue.trim();
  const blocked =
    unchanged ||
    (!allowEmpty && trimmed.length === 0) ||
    trimmed.length > PERSON_NAME_MAX_LENGTH;

  async function save() {
    if (blocked || pending) return;
    setPending(true);
    setError(null);
    const failure = await onSubmit(trimmed);
    if (closed.current) {
      if (failure !== null) toast.error(failure);
      return;
    }
    setPending(false);
    if (failure === null) {
      close();
      return;
    }
    setError(failure);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {t("description", { name: currentName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar name={avatarKey} image={image} size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                {currentName}
              </p>
              {secondary ? (
                <p className="truncate text-xs text-[var(--el-muted)]">
                  {secondary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={inputId}>{label}</Label>
              <span
                className="text-xs text-[var(--el-muted)] tabular-nums"
                aria-hidden
              >
                {trimmed.length}/{PERSON_NAME_MAX_LENGTH}
              </span>
            </div>
            <Input
              ref={inputRef}
              id={inputId}
              autoFocus
              value={value}
              maxLength={PERSON_NAME_MAX_LENGTH}
              placeholder={placeholder}
              aria-describedby={hint ? hintId : undefined}
              aria-invalid={error !== null || undefined}
              disabled={pending}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              onFocus={(event) => event.currentTarget.select()}
            />
            {hint ? (
              <p id={hintId} className="text-xs text-[var(--el-muted)]">
                {hint}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-[var(--el-error)]">
                {error}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              {tActions("cancel")}
            </AlertDialogCancel>
            <Button type="submit" loading={pending} disabled={blocked}>
              {tActions("save")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SoftName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{name}</span>;
  return (
    <motion.span
      key={name}
      className={className}
      initial={{ opacity: 0.35 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {name}
    </motion.span>
  );
}
