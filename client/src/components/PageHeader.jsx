export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-border bg-white px-6 py-6 shadow-card md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
