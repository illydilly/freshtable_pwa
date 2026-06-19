import { Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export function PlaceholderPage({ title, description }) {
  return (
    <div>
      <PageHeader title={title} subtitle="확장 가능한 Phase 2 UI를 미리 준비해두었어요." />
      <div className="soft-card flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EDF7E7] text-sage">
          <Sparkles size={28} />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-slate-900">준비 중</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">{description}</p>
      </div>
    </div>
  );
}