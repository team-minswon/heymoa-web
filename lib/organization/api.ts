import { listOrganizationsApi } from "@/lib/api/endpoints";

export function getOrganizations() {
  return listOrganizationsApi();
}
