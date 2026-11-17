import type { getProposalsResponse } from "@/lib/api/generated/proposals/proposals";
import {
  proposalSnapshotSchema,
  type ProposalSnapshot,
} from "@/lib/notes/proposals/contract";

export function selectContextSnapshot(
  response: getProposalsResponse
): ProposalSnapshot {
  if (response.status !== 200) {
    throw new Error(`Unexpected proposals response: ${response.status}`);
  }
  return proposalSnapshotSchema.parse(response.data.data);
}
