import { useMemo } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════
 * 기능 3: 식재료 입력 단위 다양화 (개수 / g / ml)
 * ════════════════════════════════════════════════════════════════════
 * - 개수 기준: [개당 용량] × [구매 개수] → 자동으로 총 용량 계산해서 표시
 * - g 기준 / ml 기준: 정량 수치를 직접 입력
 *
 * 부모 컴포넌트는 이 컴포넌트의 `value` state(unitType/grams/unitAmount/unitCount)를
 * 그대로 서버 API(/api/purchases/bulk, /api/ingredients/:id/repurchase 등)에
 * 전달하면 된다. 최종 총량(grams)은 서버의 resolveTotalGrams()가 다시 한 번
 * 계산하므로, 클라이언트 계산값은 "미리보기" 용도로만 사용해도 안전하다.
 *
 * @param {{unitType:'count'|'g'|'ml', grams:string, unitAmount:string, unitCount:string}} value
 * @param {(next: typeof value) => void} onChange
 */
export function UnitInput({ value, onChange }) {
  const { unitType, grams, unitAmount, unitCount } = value;

  // 단위 탭 전환 — 값은 유지한 채 unitType만 바꿔서 유저가 다시 입력하지 않아도 되게 함
  const setUnitType = (next) => onChange({ ...value, unitType: next });

  // 개수 기준일 때 실시간 환산 미리보기 (개당 용량 × 개수)
  const computedTotal = useMemo(() => {
    if (unitType !== 'count') return null;
    const per = Number(unitAmount) || 0;
    const cnt = Number(unitCount) || 0;
    return Math.round(per * cnt);
  }, [unitType, unitAmount, unitCount]);

  return (
    <div className="space-y-3">
      {/* 단위 선택 탭 */}
      <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
        {[
          { key: 'count', label: '개수 기준' },
          { key: 'g', label: 'g 기준' },
          { key: 'ml', label: 'ml 기준' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setUnitType(opt.key)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              unitType === opt.key ? 'bg-white text-sage shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {unitType === 'count' ? (
        // ── 개수 기준 입력: 개당 용량 × 개수 ──
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">개당 용량 (g/ml)</label>
              <input
                type="number" min="0.01" step="0.01" placeholder="예: 60"
                className="input-base text-sm"
                value={unitAmount}
                onChange={(e) => onChange({ ...value, unitAmount: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-500">구매 개수</label>
              <input
                type="number" min="0.01" step="1" placeholder="예: 10"
                className="input-base text-sm"
                value={unitCount}
                onChange={(e) => onChange({ ...value, unitCount: e.target.value })}
              />
            </div>
          </div>
          {computedTotal !== null && computedTotal > 0 && (
            <div className="rounded-xl bg-[#F4F8F1] px-3 py-2 text-xs font-semibold text-sage">
              → 자동 계산된 총 용량: <span className="text-sm">{computedTotal}g</span>
            </div>
          )}
        </div>
      ) : (
        // ── g/ml 기준 입력: 정량 직접 입력 ──
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-500">
            총 용량 ({unitType === 'ml' ? 'ml' : 'g'})
          </label>
          <input
            type="number" min="0.01" step="0.01" placeholder={unitType === 'ml' ? '예: 500' : '예: 200'}
            className="input-base text-sm"
            value={grams}
            onChange={(e) => onChange({ ...value, grams: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/** UnitInput과 짝을 이루는 기본 초기값 헬퍼 */
export function emptyUnitValue() {
  return { unitType: 'g', grams: '', unitAmount: '', unitCount: '' };
}
