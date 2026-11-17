import { webMessage } from "@/lib/i18n/web-message";
import { toast } from "@/lib/ui/toast";

const TOAST_ID = "workspace-gone";

export function notifyWorkspaceGone() {
  toast.error(webMessage("workspaceGone"), {
    id: TOAST_ID,
    duration: Infinity,
  });
}

export function notifyWorkspaceUnavailable(onSwitchAccount: () => void) {
  toast.error(webMessage("workspaceUnavailable"), {
    id: TOAST_ID,
    duration: Infinity,
    description: webMessage("workspaceUnavailableDetail"),
    action: { label: webMessage("switchAccount"), onClick: onSwitchAccount },
  });
}
