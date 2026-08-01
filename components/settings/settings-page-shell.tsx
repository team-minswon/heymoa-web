export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[660px] px-8 pb-10 pt-6">
      <header className="pb-5">
        <h1 className="text-note-title font-serif font-light">{title}</h1>
        <p className="mt-1 text-[13px] text-[var(--el-muted)]">{description}</p>
      </header>
      {children}
    </div>
  );
}
