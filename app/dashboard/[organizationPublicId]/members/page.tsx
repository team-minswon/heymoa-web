import { getOrganizationMembersForSsr } from "@/lib/organization/server";

type MembersPageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function MembersPage({ params }: MembersPageProps) {
  const { organizationPublicId } = await params;
  const members = await getOrganizationMembersForSsr(organizationPublicId);

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">Members</p>
      <h1 className="mt-4 text-3xl font-semibold">Organization members</h1>
      <p className="mt-4 text-muted-foreground">
        Review the people with access to this organization.
      </p>
      <div className="mt-8 overflow-hidden border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {member.name ?? "Unnamed member"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.email ?? "No email"}
                </td>
                <td className="px-4 py-3">{member.role}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                  }).format(new Date(member.joinedAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
