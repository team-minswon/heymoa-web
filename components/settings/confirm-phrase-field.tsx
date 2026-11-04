"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 되돌릴 수 없는 일(탈퇴·워크스페이스 삭제·나가기) 앞에서 문구를 그대로 입력받는 칸(PRO-69).
 * 맞는지는 호출부가 `confirmationMatches` 로 가른다 — 서버도 같은 규칙으로 다시 본다.
 */
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

/**
 * 받침이 있으면 「을」, 없으면 「를」. 한글로 끝나지 않으면(영문 이름 등) 둘 다 적는다.
 * 한국어 문구의 `{particle}` 자리에 넘긴다 — 영어 문구는 이 값을 쓰지 않는다.
 */
export function objectParticle(word: string) {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}
