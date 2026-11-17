"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { toast } from "@/lib/ui/toast";
import {
  getGetProjectsQueryKey,
  useCreateProject,
} from "@/lib/api/generated/projects/projects";

export function CreateProjectDialog({
  workspaceId,
  open,
  first = false,
  onOpenChange,
  onCreated,
}: {
  workspaceId: string;
  open: boolean;
  first?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const t = useTranslations("workspace.createProject");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const createProject = useCreateProject({
    mutation: { meta: { suppressErrorToast: true } },
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
  });

  const submit = async (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    try {
      await createProject.mutateAsync({
        workspaceId,
        data: { name, description: null },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetProjectsQueryKey(workspaceId),
      });
      toast.success(t("created"));
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error(t("failed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) =>
        !createProject.isPending && !next && onOpenChange(false)
      }
    >
      {open && (
        <DialogContent
          aria-label={first ? t("titleFirst") : t("title")}
          showCloseButton={!createProject.isPending}
        >
          <form action={(formData) => void submit(formData)}>
            <DialogHeader>
              <DialogTitle>
                {first ? t("titleFirst") : t("title")}
              </DialogTitle>
              <DialogDescription>
                {first ? t("descriptionFirst") : t("description")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="project-name">{t("nameLabel")}</Label>
              <Input
                id="project-name"
                name="name"
                className="mt-2"
                placeholder={first ? t("namePlaceholder") : undefined}
                maxLength={50}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createProject.isPending}
                onClick={() => onOpenChange(false)}
              >
                {tActions("cancel")}
              </Button>
              <Button type="submit" loading={createProject.isPending}>
                {tActions("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
