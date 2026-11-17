export function CenteredCard({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full max-w-[480px] rounded-2xl border border-[var(--el-hairline)] bg-white p-8 sm:p-10 text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--el-hairline)]">
        {icon}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
