"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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

/**
 * 설정에서 보이는 사람 이름의 상한. 멤버 표시 이름(서버 30)과 같다. 임시 참여자는 서버 상한이 100이지만(기존 데이터)
 * 새로 고치는 이름은 같은 30으로 받는다 — 목록·칩·화자 이름이 한 줄에 서야 한다.
 */
export const PERSON_NAME_MAX_LENGTH = 30;

/**
 * 멤버·임시 참여자 공용 이름 변경 대화상자 (APP-1206·APP-1210).
 *
 * **행 안에서 고치지 않는다.** 행에 입력을 끼우면 이름 줄과 보조 줄 높이가 달라 행이 출렁이고(APP-1203 에서 57→69px),
 * 저장·취소가 연동·삭제 버튼과 한 줄에 서 위계가 흐려진다. 대화상자는 행을 그대로 둔다.
 *
 * 연동·삭제와 같은 `AlertDialog` 를 쓴다 — 같은 설정 화면에서 대화상자의 크기·여백·열림 전환이 하나다.
 * 저장은 응답을 기다린다(버튼 loading). 실패하면 닫지 않고 이 안에 서버 문구를 남긴다 — 무엇을 고치다 실패했는지가
 * 입력과 함께 보여야 다시 누를 수 있다. 그래서 호출부의 mutation 은 전역 토스트를 끈다.
 */
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
  /** 얼굴 열쇠 — 목록 행과 같은 값을 넘겨야 같은 얼굴이 선다. */
  avatarKey: string;
  image?: string | null;
  currentName: string;
  /** 이름 아래 한 줄(이메일 등). */
  secondary?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  hint?: string;
  /** 비운 채 저장할 수 있나. 멤버는 비우면 계정 이름으로 돌아간다. */
  allowEmpty?: boolean;
  /** 실패하면 사람에게 보일 문구를 돌려준다. 성공하면 null. */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setPending(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        // 요청이 도는 동안에는 닫지 않는다 — 닫으면 실패 문구를 띄울 자리가 없다.
        if (open || pending) return;
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이름 변경</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {currentName}의 이름을 바꿉니다.
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
            <AlertDialogCancel type="button" disabled={pending}>
              취소
            </AlertDialogCancel>
            {/* 대화상자를 닫는 `AlertDialogAction` 이 아니라 폼 제출 버튼이다 — 실패하면 열어 둔다. Enter 도 같은 길이다. */}
            <Button type="submit" loading={pending} disabled={blocked}>
              저장
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 이름이 바뀔 때 **자리는 그대로 두고 글자만** 옅게 바꾼다. 폭·높이는 텍스트가 정하므로 레이아웃 이동이 없다.
 * 움직임을 줄인 환경에서는 그냥 바꾼다.
 */
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
