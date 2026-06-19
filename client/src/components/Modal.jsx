export function Modal({ open, onClose, title, children, className = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full rounded-[32px] border border-border bg-white shadow-2xl ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">닫기</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
