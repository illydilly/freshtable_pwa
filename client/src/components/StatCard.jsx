import { cn, formatCurrency } from '../lib/utils';

export function StatCard({ title, value, accent = 'sage', unit, highlight = false }) {
  const isCurrency = typeof value === 'number' && title.includes('금액');
  return (
    <div className={cn('soft-card p-5', highlight && 'ring-2 ring-sage/20')}>
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className={cn('mt-4 text-3xl font-extrabold', accent === 'coral' ? 'text-coral' : 'text-slate-900')}>
        {isCurrency ? formatCurrency(value) : value}
        {unit ? <span className="ml-2 text-base font-semibold text-slate-400">{unit}</span> : null}
      </div>
    </div>
  );
}
