import { getOrganizationMembersForSsr } from "@/lib/organization/server";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ organizationPublicId: string }>;
}) {
  const { organizationPublicId } = await params;
  const members = await getOrganizationMembersForSsr(organizationPublicId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Members</h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          현재 organization 멤버를 확인합니다.
        </p>
      </div>
      <section className="overflow-x-auto rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)]">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[1fr_120px_180px] gap-4 border-b border-[var(--clay-hairline)] px-5 py-3 text-sm font-semibold text-[var(--clay-muted)]">
            <span>Member</span>
            <span>Role</span>
            <span>Joined</span>
          </div>
          {members.map((member) => (
            <div
              key={member.userId}
              className="grid grid-cols-[1fr_120px_180px] gap-4 border-b border-[var(--clay-hairline)] px-5 py-4 text-sm last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {member.name ?? member.email ?? "사용자"}
                </p>
                <p className="truncate text-[var(--clay-muted)]">
                  {member.email ?? "이메일 없음"}
                </p>
              </div>
              <span>{member.role}</span>
              <span>
                {new Intl.DateTimeFormat("ko-KR").format(
                  new Date(member.joinedAt)
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
