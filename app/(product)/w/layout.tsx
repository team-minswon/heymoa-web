import { UserEventProvider } from "@/components/events/user-event-provider";

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserEventProvider>{children}</UserEventProvider>;
}
