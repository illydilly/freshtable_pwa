export function LoadingCard({ lines = 4 }) {
  return (
    <div className="soft-card animate-pulse p-6">
      <div className="h-5 w-36 rounded-full bg-slate-100" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-4 rounded-full bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
