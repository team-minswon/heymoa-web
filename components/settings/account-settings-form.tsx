"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useUpdateCurrentUser,
} from "@/lib/api/generated/user/user";

const accountSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(80),
});
type AccountValues = z.infer<typeof accountSchema>;

export function AccountSettingsForm() {
  const queryClient = useQueryClient();
  const query = useGetCurrentUser();
  const mutation = useUpdateCurrentUser();
  const [feedback, setFeedback] = useState<string | null>(null);
  const user =
    query.data?.status === 200 && query.data.data.success
      ? query.data.data.data
      : undefined;
  const userName = user?.name;
  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (userName) form.reset({ name: userName });
  }, [form, userName]);

  const submit = form.handleSubmit(async (values) => {
    setFeedback(null);
    try {
      await mutation.mutateAsync({ data: values });
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
      setFeedback("저장됨");
    } catch {
      setFeedback("이름을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="내 계정 설정">
      <div>
        <h2 className="font-serif text-2xl font-light tracking-tight">
          내 계정
        </h2>
        <p className="mt-1 text-sm text-[var(--el-muted)]">
          프로필에 표시되는 이름을 관리합니다.
        </p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--el-hairline)] bg-white p-5">
        <Avatar className="size-12">
          <AvatarFallback>{user?.name.slice(0, 1) ?? "나"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="account-email">이메일</Label>
          <Input id="account-email" value={user?.email ?? ""} disabled />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-name">이름</Label>
        <Input
          id="account-name"
          {...form.register("name")}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-[var(--el-error)]">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          loading={mutation.isPending}
          className="rounded-full"
        >
          변경사항 저장
        </Button>
        {feedback && (
          <p role="status" className="text-sm text-[var(--el-muted)]">
            {feedback}
          </p>
        )}
      </div>
    </form>
  );
}
