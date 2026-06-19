import { useState } from 'react';
import { Loader2, Sparkles, RefreshCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { calculateNutrition, estimateWithAI } from '../lib/nutritionCalc';

/**
 * 재사용 가능한 영양정보 자동 계산 컴포넌트
 * 사용법: <NutritionAutoCalc ingredients={[{name,grams}]} onResult={(nutrition)=>setForm(...)} />
 */
export function NutritionAutoCalc({ ingredients, onResult }) {
  const [calculating, setCalculating] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [error, setError] = useState('');
  const [aiApplied, setAiApplied] = useState(false);

  const validCount = ingredients.filter(i => i.name?.trim() && Number(i.grams) > 0).length;

  const handleCalculate = async () => {
    if (validCount === 0) return;
    setCalculating(true); setError(''); setCalcResult(null); setAiApplied(false);
    try {
      const result = await calculateNutrition(ingredients);
      setCalcResult(result);
      if (result && onResult) onResult(result.total);
    } catch (err) {
      setError(err.response?.data?.message || '계산 중 오류가 발생했습니다.');
    } finally { setCalculating(false); }
  };

  const handleAIEstimate = async () => {
    if (!calcResult?.missingIngredients?.length) return;
    setEstimating(true); setError('');
    try {
      const aiNutrition = await estimateWithAI(calcResult.missingIngredients);
      // 기존 계산 결과 + AI 추정값 합산
      const merged = {
        calories: (calcResult.total.calories || 0) + (aiNutrition.calories || 0),
        carbs:    Math.round(((calcResult.total.carbs    || 0) + (aiNutrition.carbs    || 0)) * 100) / 100,
        protein:  Math.round(((calcResult.total.protein  || 0) + (aiNutrition.protein  || 0)) * 100) / 100,
        fat:      Math.round(((calcResult.total.fat      || 0) + (aiNutrition.fat      || 0)) * 100) / 100,
        sodium:   Math.round(((calcResult.total.sodium   || 0) + (aiNutrition.sodium   || 0)) * 100) / 100,
        sugar:    Math.round(((calcResult.total.sugar    || 0) + (aiNutrition.sugar    || 0)) * 100) / 100,
      };
      setCalcResult(prev => ({ ...prev, total: merged, aiAdded: aiNutrition }));
      setAiApplied(true);
      if (onResult) onResult(merged);
    } catch (err) {
      setError(err.response?.data?.message || 'AI 추정 실패. ANTHROPIC_API_KEY가 서버에 설정돼 있는지 확인해 주세요.');
    } finally { setEstimating(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-[#F8FAF7] p-4 space-y-3">
      {/* 헤더 + 계산 버튼 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-700">영양정보 자동 계산</div>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={calculating || validCount === 0}
          className="flex items-center gap-1.5 rounded-xl bg-sage px-3 py-2 text-xs font-semibold text-white hover:bg-opacity-90 disabled:opacity-50 transition-all"
        >
          {calculating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          {calculating ? '계산 중...' : `재료로 자동 계산 (${validCount}개)`}
        </button>
      </div>

      {validCount === 0 && (
        <p className="text-xs text-slate-400">이름과 그램수가 입력된 재료가 있어야 계산할 수 있어요.</p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* 재료별 결과 */}
      {calcResult && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">재료별 조회 결과</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {calcResult.perIngredient.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                <span className="font-medium text-slate-700">{r.name} <span className="text-slate-400">{r.grams}g</span></span>
                {r.found ? (
                  <span className="flex items-center gap-1 rounded-full bg-[#EDF7E7] px-2 py-0.5 font-semibold text-sage">
                    <CheckCircle size={10} />
                    {r.calories}kcal
                    <span className="text-slate-400 font-normal ml-0.5">{r.source === 'db' ? 'DB' : '공공API'}</span>
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-400">미확인</span>
                )}
              </div>
            ))}
          </div>

          {/* 합계 표시 */}
          <div className="rounded-xl bg-sage/10 border border-sage/20 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sage">
                {aiApplied ? '총합 (DB + API + AI 추정)' : '총합 (DB + API)'}
              </span>
              <span className="text-base font-extrabold text-sage">{calcResult.total.calories}kcal</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-slate-500">
              <span>탄수 {calcResult.total.carbs}g</span>
              <span>단백 {calcResult.total.protein}g</span>
              <span>지방 {calcResult.total.fat}g</span>
              <span>나트륨 {calcResult.total.sodium}mg</span>
              <span>당류 {calcResult.total.sugar}g</span>
            </div>
            {aiApplied && (
              <div className="mt-1 text-[10px] text-purple-500 font-semibold">✨ AI 추정값 포함됨 (참고용)</div>
            )}
          </div>

          {/* AI 추정 버튼 — 미확인 재료 있을 때만 */}
          {calcResult.missingCount > 0 && !aiApplied && (
            <button
              type="button"
              onClick={handleAIEstimate}
              disabled={estimating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 py-2.5 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-blue-100 transition-all disabled:opacity-60"
            >
              {estimating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {estimating
                ? 'AI가 추정 중...'
                : `미확인 ${calcResult.missingCount}개 항목 AI(Claude)로 추정`}
            </button>
          )}
          {calcResult.missingCount > 0 && !aiApplied && (
            <p className="text-[10px] text-slate-400 text-center">AI 추정값은 참고용이며 실제와 다를 수 있습니다. 서버에 ANTHROPIC_API_KEY 필요.</p>
          )}
        </div>
      )}
    </div>
  );
}
