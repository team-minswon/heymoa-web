"use client";

import { useEffect, useState } from "react";
import { PanelRightClose } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { Button } from "@/components/ui/button";

export function NoteAgentRail({
  onCollapse,
  collapseDisabled,
}: {
  onCollapse: () => void;
  collapseDisabled: boolean;
}) {
  const t = useTranslations("notes.agentRail");
  const { setRailSlot } = usePersonalChat();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setRailSlot(slot);
    return () => setRailSlot(null);
  }, [setRailSlot, slot]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      <h2 className="sr-only">{t("title")}</h2>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-[7px] right-3 z-10 size-[34px] rounded-control text-[var(--el-body)] aria-expanded:bg-transparent hover:bg-[var(--el-surface-strong)] pointer-coarse:top-0.5 pointer-coarse:size-11 [&_svg]:size-[18px]"
        aria-label={collapseDisabled ? t("collapseBusy") : t("collapse")}
        title={collapseDisabled ? t("collapseBusy") : t("collapseShort")}
        aria-expanded
        disabled={collapseDisabled}
        onClick={onCollapse}
      >
        <PanelRightClose />
      </Button>
      <div ref={setSlot} className="flex min-h-0 flex-1" />
    </div>
  );
}
