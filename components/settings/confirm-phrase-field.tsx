"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmPhraseField({
  phrase,
  value,
  onChange,
  disabled,
}: {
  phrase: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const t = useTranslations("settings.confirmPhrase");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="block font-normal leading-5">
        {t.rich("label", {
          phrase,
          particle: objectParticle(phrase),
          strong: (chunks) => (
            <span className="font-medium text-[var(--el-ink)]">{chunks}</span>
          ),
        })}
      </Label>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function objectParticle(word: string) {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}
