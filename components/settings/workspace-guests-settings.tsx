"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Loader2Icon,
  MoreHorizontal,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  SETTINGS_LIST,
  SETTINGS_LIST_ROW,
  SkeletonLine,
} from "@/components/settings/settings-layout";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { objectParticle } from "@/components/settings/confirm-phrase-field";
import {
  RenamePersonDialog,
  SoftName,
} from "@/components/settings/rename-person-dialog";
import {
  getGetWorkspaceGuestsQueryKey,
  useDeleteWorkspaceGuest,
  useLinkWorkspaceGuest,
  usePreviewWorkspaceGuestLink,
} from "@/lib/api/generated/workspaces/workspaces";
import {
  isNoteQueryKey,
  isNoteTranscriptQueryKey,
} from "@/lib/notes/query-keys";
import { invalidateNoteLists } from "@/lib/notes/invalidate";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { useQueryClient } from "@tanstack/react-query";
import { useGuestListPages } from "@/lib/workspace/use-guest-list-pages";
import { useRenameGuest } from "@/lib/workspace/use-rename-guest";
import type {
  GuestLinkResponseData,
  WorkspaceGuestListResponseDataGuestsItem,
  WorkspaceMemberListResponseDataMembersItem,
} from "@/lib/api/generated/models";

type GuestDialogKind = "rename" | "link" | "delete";

export function WorkspaceGuestsSettings({
  workspaceId,
  canManage,
  standalone = false,
}: {
  workspaceId: string;
  canManage: boolean;
  standalone?: boolean;
}) {
  const t = useTranslations("settings.guests");
  const tActions = useTranslations("common.actions");
  const [pages, setPages] = useState(1);
  const guestsQuery = useGuestListPages({ workspaceId, pages });
  const [dialog, setDialog] = useState<{
    kind: GuestDialogKind;
    guest: WorkspaceGuestListResponseDataGuestsItem;
  } | null>(null);

  const response = guestsQuery.data;
  const page =
    response?.status === 200 && response.data.success
      ? response.data.data
      : undefined;
  const guests = page?.guests ?? [];
  const freshOf = (guestId: string) =>
    guests.find((item) => item.guestId === guestId);
  const partial =
    (response as { partial?: boolean } | undefined)?.partial === true;
  const isLoadingMore = guestsQuery.isFetching && guestsQuery.isPlaceholderData;

  return (
    <section
      className={
        standalone
          ? undefined
          : "mt-8 border-t border-[var(--el-hairline)] pt-8"
      }
    >
      <GuestsHeading
        standalone={standalone}
        totalCount={page?.totalCount}
        isLoading={guestsQuery.isLoading}
      />

      {guestsQuery.isLoading ? (
        <ul
          className={cn("mt-4", SETTINGS_LIST)}
          aria-label={t("loading")}
        >
          {Array.from({ length: SKELETON_GUEST_ROWS }, (_, index) => (
            <GuestRowSkeleton key={index} />
          ))}
        </ul>
      ) : /* **들고 있는 목록이 있으면 실패로 덮지 않는다.** 캐시를 든 채 리패치만 실패해도
             TanStack 은 `isError` 가 된다 — 그때 목록을 오류 화면으로 바꾸면 이미 보이던
             임시 참여자와 연동·삭제가 **재시도가 성공할 때까지 통째로 사라진다.**

             `guests.length === 0` 으로 가르면 안 된다. 정상적으로 빈 목록을 캐시한 뒤 실패하면
             빈 안내 대신 오류가 뜬다 — 길이가 아니라 **응답을 든 적이 있는가**다. */
      guestsQuery.isError && guestsQuery.data === undefined ? (
        <div role="alert" className="mt-4 space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void guestsQuery.refetch()}
          >
            {tActions("retry")}
          </Button>
        </div>
      ) : guests.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--el-muted)]">
          {t("empty")}
        </p>
      ) : (
        <>
          {(guestsQuery.isError && guestsQuery.data !== undefined) ||
          partial ? (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 text-sm text-[var(--el-muted)]"
            >
              <span>
                {partial
                  ? t("lockedPartial")
                  : t("lockedStale")}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void guestsQuery.refetch()}
              >
                {tActions("retry")}
              </Button>
            </div>
          ) : null}
          <ul className={cn("mt-4", SETTINGS_LIST)}>
            {guests.map((guest) => (
              <GuestRow
                key={guest.guestId}
                guest={guest}
                canRename={canManage}
                canManage={
                  canManage &&
                  !guestsQuery.isError &&
                  !guestsQuery.isFetching &&
                  !partial
                }
                onOpen={(kind) => {
                  setDialog({ kind, guest });
                  if (kind !== "rename") void guestsQuery.refetch();
                }}
              />
            ))}
          </ul>
          {page?.hasMore ? (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={isLoadingMore}
                onClick={() => setPages((current) => current + 1)}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2Icon className="animate-spin" /> {t("loadingMore")}
                  </>
                ) : (
                  t("loadMore")
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {dialog?.kind === "rename" ? (
        <RenameGuestDialog
          guest={dialog.guest}
          workspaceId={workspaceId}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "link" ? (
        <LinkGuestDialog
          guest={dialog.guest}
          workspaceId={workspaceId}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeleteGuestDialog
          guest={dialog.guest}
          workspaceId={workspaceId}
          fresh={freshOf(dialog.guest.guestId)}
          settled={!guestsQuery.isFetching && !guestsQuery.isError && !partial}
          lookupFailed={
            guestsQuery.isError ||
            partial ||
            (page?.hasMore === true && !freshOf(dialog.guest.guestId))
          }
          onRetry={() => void guestsQuery.refetch()}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

function GuestsHeading({
  standalone,
  totalCount,
  isLoading,
}: {
  standalone: boolean;
  totalCount: number | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("settings.guests");
  if (standalone) {
    if (totalCount !== undefined)
      return (
        <p className="text-sm text-[var(--el-muted)]">
          {t("count", { count: totalCount })}
        </p>
      );
    return isLoading ? <SkeletonLine className="w-10" /> : null;
  }
  return (
    <>
      <h3 className="text-[15px] font-semibold text-[var(--el-ink)]">
        {t("title")}
        {totalCount !== undefined ? (
          <span className="ml-1.5 font-normal text-[var(--el-muted)]">
            {t("count", { count: totalCount })}
          </span>
        ) : null}
      </h3>
      <p className="mt-1.5 text-sm text-[var(--el-muted)]">
        {t("description")}
      </p>
    </>
  );
}

function GuestRow({
  guest,
  canManage,
  canRename,
  onOpen,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  canManage: boolean;
  canRename: boolean;
  onOpen: (kind: GuestDialogKind) => void;
}) {
  const t = useTranslations("settings.guests");
  const tActions = useTranslations("common.actions");
  return (
    <li className={SETTINGS_LIST_ROW}>
      <PersonAvatar name={guest.guestId} size={28} />
      <span className="flex min-w-0 flex-1 flex-col">
        <SoftName
          name={guest.displayName}
          className="truncate text-sm text-[var(--el-ink)]"
        />
        <span className="text-xs text-[var(--el-muted)]">
          {t("noteCount", { count: guest.noteCount })}
        </span>
      </span>

      <span className="flex w-8 shrink-0 justify-end">
        {canRename ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("manageLabel", { name: guest.displayName })}
                  className="rounded-full text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)]"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={() => onOpen("rename")}>
                {tActions("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canManage}
                onClick={() => onOpen("link")}
              >
                {t("link")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!canManage}
                onClick={() => onOpen("delete")}
              >
                {tActions("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </span>
    </li>
  );
}

const SKELETON_GUEST_ROWS = 5;

function GuestRowSkeleton() {
  return (
    <li className={SETTINGS_LIST_ROW}>
      <Skeleton className="size-7 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col">
        <SkeletonLine className="w-20" />
        <SkeletonLine size="xs" className="w-16" />
      </span>
      <span className="w-8 shrink-0" />
    </li>
  );
}

function RenameGuestDialog({
  guest,
  workspaceId,
  onClose,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  workspaceId: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.guests");
  const { rename } = useRenameGuest({
    workspaceId,
    guestId: guest.guestId,
    displayName: guest.displayName,
  });
  return (
    <RenamePersonDialog
      avatarKey={guest.guestId}
      currentName={guest.displayName}
      secondary={`${t("title")} · ${t("noteCount", { count: guest.noteCount })}`}
      label={t("nameLabel")}
      initialValue={guest.displayName}
      onSubmit={rename}
      onClose={onClose}
    />
  );
}

function LinkGuestDialog({
  guest,
  workspaceId,
  onClose,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  workspaceId: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.guests.linkDialog");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const membersQuery = useGetWorkspaceMembers(workspaceId, {
    query: { refetchOnMount: "always" },
  });
  const preview = usePreviewWorkspaceGuestLink();
  const link = useLinkWorkspaceGuest();

  const [target, setTarget] =
    useState<WorkspaceMemberListResponseDataMembersItem | null>(null);
  const [plan, setPlan] = useState<GuestLinkResponseData | null>(null);
  const [result, setResult] = useState<GuestLinkResponseData | null>(null);

  const membersResponse = membersQuery.data;
  const members =
    membersResponse?.status === 200 && membersResponse.data.success
      ? (membersResponse.data.data?.members ?? [])
      : [];
  const membersPending = membersQuery.isPending;
  const membersFailed =
    !membersPending && (membersQuery.isError || members.length === 0);
  const membersSettled = !membersQuery.isFetching && !membersQuery.isError;

  async function choose(member: WorkspaceMemberListResponseDataMembersItem) {
    setTarget(member);
    try {
      const response = await preview.mutateAsync({
        workspaceId,
        guestId: guest.guestId,
        data: { targetUserId: member.userId },
      });
      if (response.status !== 200 || !response.data.success) return;
      setPlan(response.data.data);
    } catch {
      setTarget(null);
    }
  }

  async function run() {
    if (!target) return;
    try {
      const response = await link.mutateAsync({
        workspaceId,
        guestId: guest.guestId,
        data: { targetUserId: target.userId },
      });
      if (response.status !== 200 || !response.data.success) return;
      setResult(response.data.data);
      await Promise.all([
        queryClient.invalidateQueries({ predicate: isNoteQueryKey }),
        queryClient.invalidateQueries({ predicate: isNoteTranscriptQueryKey }),
        invalidateNoteLists(queryClient),
      ]);
    } catch {
      setPlan(null);
      setTarget(null);
      return;
    }
  }

  async function finish() {
    onClose();
    await queryClient.invalidateQueries({
      queryKey: getGetWorkspaceGuestsQueryKey(workspaceId),
    });
  }

  const pending = preview.isPending || link.isPending;

  const shown = result ?? plan;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (open || pending) return;
        void finish();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {result
              ? t("resultTitle", { name: guest.displayName })
              : t("title", {
                  name: guest.displayName,
                  particle: objectParticle(guest.displayName),
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result
              ? t("done")
              : target
                ?
                  t("target", { name: target.name, email: target.email })
                : t("choose")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!target && membersFailed ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-[var(--el-ink)]">{t("membersFailed")}</p>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={() => void membersQuery.refetch()}
            >
              {tActions("retry")}
            </Button>
          </div>
        ) : !target && (membersPending || !membersSettled) ? (
          <Skeleton className="h-24 rounded-block" />
        ) : !target ? (
          <MemberPickList
            members={members}
            onChoose={(member) => void choose(member)}
          />
        ) : (
          <div className="grid gap-3">
            <LinkPair guest={guest} target={target} />
            {preview.isPending ? (
              <Skeleton className="h-24 rounded-block" />
            ) : shown ? (
              <LinkPlanSummary plan={shown} executed={result !== null} />
            ) : null}
          </div>
        )}

        <AlertDialogFooter>
          {result ? (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void finish();
              }}
            >
              {tActions("confirm")}
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={pending} onClick={onClose}>
                {tActions("cancel")}
              </AlertDialogCancel>
              {target && shown ? (
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void run();
                  }}
                  loading={link.isPending}
                  disabled={pending}
                >
                  {t("submit")}
                </AlertDialogAction>
              ) : null}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MemberPickList({
  members,
  onChoose,
}: {
  members: WorkspaceMemberListResponseDataMembersItem[];
  onChoose: (member: WorkspaceMemberListResponseDataMembersItem) => void;
}) {
  return (
    <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-block border border-[var(--el-hairline)] p-1">
      {members.map((member) => (
        <li key={member.userId}>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors outline-none hover:bg-[var(--el-surface-strong)] focus-visible:bg-[var(--el-hairline)] focus-visible:font-medium motion-reduce:transition-none"
            onClick={() => onChoose(member)}
          >
            <PersonAvatar
              name={member.userId}
              image={member.image}
              size={28}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-[var(--el-ink)]">
                {member.name}
              </span>
              <span className="block truncate text-xs font-normal text-[var(--el-muted)]">
                {member.email}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LinkPair({
  guest,
  target,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  target: WorkspaceMemberListResponseDataMembersItem;
}) {
  const t = useTranslations("settings.guests.linkDialog");
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-block border border-[var(--el-hairline)] px-3 py-2.5">
      <PersonAvatar name={guest.guestId} size={24} />
      <span className="min-w-0 truncate text-sm text-[var(--el-ink)]">
        {guest.displayName}
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-[var(--el-muted)]"
        aria-hidden
      />
      <span className="sr-only">
        {t("pairSeparator", { particle: objectParticle(guest.displayName) })}
      </span>
      <PersonAvatar name={target.userId} image={target.image} size={24} />
      <span className="min-w-0 truncate text-sm font-medium text-[var(--el-ink)]">
        {target.name}
      </span>
    </div>
  );
}

function LinkPlanSummary({
  plan,
  executed,
}: {
  plan: GuestLinkResponseData;
  executed: boolean;
}) {
  const t = useTranslations("settings.guests.linkDialog");
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[var(--el-ink)]">
        {t(executed ? "changed" : "willChange", {
          count: plan.changedNoteCount,
        })}
      </p>

      {plan.changedNotes.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-[var(--el-muted)]">
          {plan.changedNotes.map((note) => (
            <li key={note.noteId} className="truncate">
              {note.title}
            </li>
          ))}
        </ul>
      ) : null}

      {plan.changedNoteCount > plan.changedNotes.length ? (
        <p className="text-[var(--el-muted-soft)]">
          {t("truncated", { count: plan.changedNotes.length })}
        </p>
      ) : null}

      {!executed ? (
        <p className="flex items-start gap-1.5 text-[var(--el-error)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("irreversible")}</span>
        </p>
      ) : null}
    </div>
  );
}

function DeleteGuestDialog({
  guest,
  workspaceId,
  fresh,
  settled,
  lookupFailed,
  onRetry,
  onClose,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  workspaceId: string;
  fresh: WorkspaceGuestListResponseDataGuestsItem | undefined;
  settled: boolean;
  lookupFailed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings.guests.deleteDialog");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const remove = useDeleteWorkspaceGuest();
  const goneAlready = settled && fresh === undefined;
  const noteCount = fresh?.noteCount ?? guest.noteCount;

  async function run() {
    try {
      await remove.mutateAsync({ workspaceId, guestId: guest.guestId });
    } catch {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId),
      }),
      queryClient.invalidateQueries({ predicate: isNoteQueryKey }),
      queryClient.invalidateQueries({ predicate: isNoteTranscriptQueryKey }),
      invalidateNoteLists(queryClient),
    ]);
    onClose();
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (open || remove.isPending) return;
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("title", {
              name: guest.displayName,
              particle: objectParticle(guest.displayName),
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lookupFailed
              ? t("lookupFailed")
              : goneAlready
                ? t("gone")
                : !settled
                  ? t("checking")
                  : t("description", { count: noteCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {lookupFailed ? (
          <div role="alert">
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={onRetry}
            >
              {tActions("retry")}
            </Button>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} onClick={onClose}>
            {tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void run();
            }}
            loading={remove.isPending}
            disabled={!settled || goneAlready}
          >
            {tActions("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
