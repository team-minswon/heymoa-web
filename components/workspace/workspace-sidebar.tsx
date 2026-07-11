"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  ChevronUp,
  Folder,
  FolderPlus,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getListWorkspaceFoldersQueryKey,
  useCreateFolder,
  useDeleteFolder,
  useUpdateFolder,
} from "@/lib/api/generated/folder/folder";
import type {
  FolderResponse,
  WorkspaceResponse,
} from "@/lib/api/generated/models";
import { getListWorkspaceNotesQueryKey } from "@/lib/api/generated/note/note";

type FolderDialogState =
  | { mode: "create" }
  | { mode: "rename"; folder: FolderResponse }
  | null;

export function WorkspaceSidebar({
  workspaceId,
  workspace,
  folders,
  selectedFolderId,
  onSelectFolder,
}: {
  workspaceId: string;
  workspace?: WorkspaceResponse;
  folders: FolderResponse[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderResponse | null>(null);

  const refreshFolders = () =>
    queryClient.invalidateQueries({
      queryKey: getListWorkspaceFoldersQueryKey(workspaceId),
    });

  const handleFolderSubmit = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name || !folderDialog) return;

    if (folderDialog.mode === "create") {
      await createFolder.mutateAsync({ workspaceId, data: { name } });
    } else {
      await updateFolder.mutateAsync({
        folderId: folderDialog.folder.folderId,
        data: { name },
      });
    }
    await refreshFolders();
    setFolderDialog(null);
  };

  const initials = user?.name?.trim().slice(0, 1) || "H";

  return (
    <>
      <SidebarHeader className="gap-4 border-b border-sidebar-border p-4">
        <Link href={`/w/${workspaceId}`} className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              HeyMoa
            </p>
            <p className="truncate text-sm font-medium">
              {workspace?.name ?? "워크스페이스"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="워크스페이스">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={selectedFolderId === null}
                    onClick={() => onSelectFolder(null)}
                  >
                    <NotebookText />
                    <span>모든 노트</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>폴더</SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="새 폴더"
              onClick={() => setFolderDialog({ mode: "create" })}
            >
              <FolderPlus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {folders.map((folder) => (
                  <SidebarMenuItem key={folder.folderId}>
                    <SidebarMenuButton
                      isActive={selectedFolderId === folder.folderId}
                      onClick={() => onSelectFolder(folder.folderId)}
                    >
                      <Folder />
                      <span>{folder.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <SidebarMenuAction
                            aria-label={`${folder.name} 폴더 메뉴`}
                            showOnHover
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() =>
                            setFolderDialog({ mode: "rename", folder })
                          }
                        >
                          <Pencil /> 이름 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(folder)}
                        >
                          <Trash2 /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-auto w-full justify-start p-2" />
            }
          >
            <Avatar className="size-8">
              <AvatarImage src={user?.image ?? undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">
                {user?.name ?? "사용자"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.email ?? ""}
              </span>
            </span>
            <ChevronUp className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLinkItem href="/settings">
              <Settings /> 설정
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {workspace?.name ?? "워크스페이스"}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => !open && setFolderDialog(null)}
      >
        <DialogContent aria-label={folderDialog?.mode === "rename" ? "폴더 이름 변경" : "새 폴더 만들기"}>
          <form action={(formData) => void handleFolderSubmit(formData)}>
            <DialogHeader>
              <DialogTitle>
                {folderDialog?.mode === "rename"
                  ? "폴더 이름 변경"
                  : "새 폴더 만들기"}
              </DialogTitle>
              <DialogDescription>
                노트를 분류할 폴더 이름을 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="folder-name">폴더 이름</Label>
              <Input
                id="folder-name"
                name="name"
                className="mt-2"
                maxLength={50}
                required
                autoFocus
                defaultValue={
                  folderDialog?.mode === "rename"
                    ? folderDialog.folder.name
                    : ""
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFolderDialog(null)}>
                취소
              </Button>
              <Button type="submit">저장</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>폴더를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} 폴더가 삭제됩니다. 노트 자체는 삭제되지
              않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteFolder.mutateAsync({
                  folderId: deleteTarget.folderId,
                });
                if (selectedFolderId === deleteTarget.folderId) {
                  onSelectFolder(null);
                }
                await Promise.all([
                  refreshFolders(),
                  queryClient.invalidateQueries({
                    queryKey: getListWorkspaceNotesQueryKey(workspaceId),
                  }),
                ]);
                setDeleteTarget(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
