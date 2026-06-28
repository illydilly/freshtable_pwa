// client/src/components/UnitInput.jsx
import { useMemo } from 'react';

/**
 * 단위 선택 + 자동 환산 입력 컴포넌트
 * 지원 단위: 개수(count) / g / ml / kg
 *
 * @param {{ unitType:'count'|'g'|'ml'|'kg', grams:string, unitAmount:string, unitCount:string }} value
 * @param {(next: typeof value) => void} onChange
 */
export function UnitInput({ value, onChange }) {
  const { unitType, grams, unitAmount, unitCount } = value;
  const setUnitType = (next) => onChange({ ...value, unitType: next });

  // 개수 모드: 미리보기 총 용량 계산
  const computedTotal = useMemo(() => {
    if (unitType !== 'count') return null;
    return Math.round((Number(unitAmount) || 0) * (Number(unitCount) || 0));
  }, [unitType, unitAmount, unitCount]);

  // kg 모드: g 환산 미리보기
  const kgPreview = useMemo(() => {
    if (unitType !== 'kg') return null;
    const kg = Number(grams) || 0;
    return kg > 0 ? `= ${Math.round(kg * 1000)}g` : null;
  }, [unitType, grams]);

  const UNIT_TABS = [
    { key: 'g',     label: 'g 기준'  },
    { key: 'ml',    label: 'ml 기준' },
    { key: 'kg',    label: 'kg 기준' },  // #3 추가
    { key: 'count', label: '개수 기준' },
  ];

  return (
    <div className="space-y-3">
      {/* 단위 탭 */}
      <div className="flex rounded-2xl bg-slate-100 p-1 gap-1 flex-wrap">
        {UNIT_TABS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setUnitType(opt.key)}
            className={`flex-1 min-w-0 rounded-xl py-2 text-xs font-bold transition-all ${
              unitType === opt.key ? 'bg-white text-sage shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 개수 기준 */}
      {unitType === 'count' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">개당 용량 (g/ml)</label>
              <input type="number" min="0.01" step="0.01" placeholder="예: 60"
                className="input-base text-sm" value={unitAmount}
                onChange={(e) => onChange({ ...value, unitAmount: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">구매 개수</label>
              <input type="number" min="1" step="1" placeholder="예: 10"
                className="input-base text-sm" value={unitCount}
                onChange={(e) => onChange({ ...value, unitCount: e.target.value })} />
            </div>
          </div>
          {computedTotal > 0 && (
            <div className="rounded-xl bg-[#F4F8F1] px-3 py-2 text-xs font-semibold text-sage">
              → 자동 환산 총 용량: <span className="text-sm">{computedTotal}g</span>
            </div>
          )}
        </div>
      )}

      {/* g / ml 기준 */}
      {(unitType === 'g' || unitType === 'ml') && (
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-500">
            총 용량 ({unitType})
          </label>
          <input type="number" min="0.01" step="0.01"
            placeholder={unitType === 'ml' ? '예: 500' : '예: 200'}
            className="input-base text-sm" value={grams}
            onChange={(e) => onChange({ ...value, grams: e.target.value })} />
        </div>
      )}

      {/* kg 기준 — #3 */}
      {unitType === 'kg' && (
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-500">
            총 용량 (kg) — 1kg = 1000g 자동 환산
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min="0.001" step="0.001" placeholder="예: 1.5"
              className="input-base text-sm flex-1" value={grams}
              onChange={(e) => onChange({ ...value, grams: e.target.value })} />
            {kgPreview && (
              <span className="text-xs font-semibold text-sage whitespace-nowrap">{kgPreview}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function emptyUnitValue() {
  return { unitType: 'g', grams: '', unitAmount: '', unitCount: '' };
}
