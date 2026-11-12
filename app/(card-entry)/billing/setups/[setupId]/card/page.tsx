import { renderCardEntry } from "./card-entry-route";

export default function BillingCardEntryRoute({
  params,
}: {
  params: Promise<{ setupId: string }>;
}) {
  return renderCardEntry(params, false);
}
