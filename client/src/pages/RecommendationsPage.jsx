import { useEffect, useState } from 'react';
import { ChefHat, Refrigerator, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

export function RecommendationsPage() {
  const [ownedIngredients, setOwnedIngredients] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedTools, setSelectedTools] = useState('');
  const [keyword, setKeyword] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    api.get('/ingredients').then(res => {
      const items = res.data.filter(i => (i.remainingGrams || (i.totalGrams - i.usedGrams)) > 0);
      setOwnedIngredients(items);
    });
  }, []);

  // #11: 식재료 선택 토글
  const toggleIngredient = (name) => {
    setSelectedIngredients(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const selectAll = () => setSelectedIngredients(ownedIngredients.map(i => i.name));
  const clearAll = () => setSelectedIngredients([]);

  // #11: 추천 실행 (저장 레시피 + 공공 API + 태그 오버랩 점수)
  const recommend = async () => {
    if (selectedIngredients.length === 0) { alert('추천에 활용할 식재료를 하나 이상 선택해 주세요.'); return; }
    setLoading(true);
    try {
      const tools = selectedTools.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
      // #4: keyword를 비워도 서버가 selectedIngredients로 자동 검색
      const res = await api.post('/recommendations/by-ingredients', {
        selectedIngredients,
        selectedTools: tools,
        keyword: keyword.trim()
      });
      setRecommendations(res.data);
      setInitialized(true);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader title="레시피 추천" subtitle="보유한 식재료를 선택하면, 선택한 식재료를 가장 다양하게 포함하는 레시피를 추천합니다."/>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 사이드 - 식재료 선택 패널 */}
        <section className="soft-card h-fit p-6 space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Refrigerator size={18} className="text-sage"/> 매칭 식재료 선택
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="rounded-lg bg-[#EDF7E7] px-2.5 py-1 text-xs font-semibold text-sage">전체 선택</button>
                <button onClick={clearAll} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">초기화</button>
              </div>
            </div>
            {ownedIngredients.length === 0 ? (
              <p className="text-sm text-slate-400">등록된 식재료가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ownedIngredients.map(item => (
                  <button key={item.name} type="button" onClick={() => toggleIngredient(item.name)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${
                      selectedIngredients.includes(item.name)
                        ? 'border-sage bg-sage text-white'
                        : 'border-border bg-[#FCFCFC] text-slate-600 hover:border-sage'
                    }`}>
                    {item.name}
                    <span className={`ml-1 text-xs ${selectedIngredients.includes(item.name)?'opacity-80':'text-slate-400'}`}>
                      {item.remainingGrams ?? Math.max(item.totalGrams - item.usedGrams, 0)}g
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedIngredients.length > 0 && (
              <div className="mt-3 rounded-xl bg-[#F4F8F1] px-3 py-2 text-xs text-sage font-semibold">
                선택됨: {selectedIngredients.join(', ')}
              </div>
            )}
          </div>

          {/* 조리도구 필터 (선택) */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">보유 조리도구 (선택, 쉼표 구분)</label>
            <input className="input-base" placeholder="예: 냄비, 프라이팬, 에어프라이어" value={selectedTools} onChange={e=>setSelectedTools(e.target.value)}/>
            <p className="mt-1 text-xs text-slate-400">입력 시 조리도구가 일치하는 레시피를 추가 점수로 우선 추천합니다.</p>
          </div>

          {/* #4: 선택한 식재료로 자동 검색되므로 키워드는 선택적 보조 입력 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">추가 검색어 (선택)</label>
            <div className="flex gap-2">
              <input className="input-base flex-1" placeholder="예: 된장찌개, 볶음밥 (생략 가능)" value={keyword} onChange={e=>setKeyword(e.target.value)}/>
            </div>
            <p className="mt-1 text-xs text-slate-400">선택한 식재료명으로 저장 레시피와 공공 조리식품 DB를 자동 검색합니다. 더 구체적인 메뉴를 찾고 싶을 때만 입력하세요.</p>
          </div>

          <button onClick={recommend} disabled={loading || selectedIngredients.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage px-5 py-3.5 font-bold text-white disabled:opacity-60">
            <Sparkles size={18}/> {loading?'추천 분석 중...':'레시피 추천받기'}
          </button>
        </section>

        {/* 추천 결과 */}
        <section className="lg:col-span-2">
          {!initialized ? (
            <div className="soft-card p-12 text-center text-slate-400">
              <ChefHat size={48} className="mx-auto mb-4 text-slate-200"/>
              <div className="font-semibold">식재료를 선택하고 추천받기 버튼을 눌러주세요.</div>
              <p className="mt-2 text-sm">저장된 레시피와 공공 조리식품 DB에서 선택한 식재료를 가장 다양하게 포함하는 순서로 추천합니다.</p>
            </div>
          ) : loading ? (
            <div className="soft-card p-8 text-center text-slate-400">최적의 레시피 조합을 분석하고 있습니다...</div>
          ) : recommendations.length === 0 ? (
            <div className="soft-card p-8 text-center text-slate-400">선택한 식재료와 일치하는 레시피를 찾을 수 없습니다.</div>
          ) : (
            <div className="space-y-5">
              {recommendations.map((recipe, idx) => (
                <div key={recipe.resultKey || `${recipe.source}-${recipe.name}-${idx}`} className="soft-card overflow-hidden bg-white">
                  <div className="flex flex-col sm:flex-row">
                    {recipe.thumbnail ? (
                      <img src={recipe.thumbnail} alt={recipe.name} className="h-40 w-full shrink-0 object-cover sm:w-44"/>
                    ) : (
                      <div className="flex h-40 w-full shrink-0 items-center justify-center bg-[#EDF7E7] sm:w-44">
                        <ChefHat size={36} className="text-sage"/>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <h3 className="text-xl font-bold text-slate-900">{recipe.name}</h3>
                          <div className="flex items-center gap-2">
                            {/* #11: 매칭된 식재료 수 배지 */}
                            <div className="rounded-full bg-[#F4F8F1] px-3 py-1 text-sm font-bold text-sage">
                              재료 {recipe.matchScore?.toFixed(1) || 0}개 매칭
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recipe.source==='public'?'bg-blue-50 text-blue-600':'bg-[#EDF7E7] text-sage'}`}>
                              {recipe.source==='public'?'공공 DB':'저장 레시피'}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{recipe.calories || 0} kcal{recipe.satisfaction?` · 만족도 ${recipe.satisfaction}점`:''}</p>
                      </div>

                      {/* 매칭된 재료 태그 */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {(recipe.ingredients || []).slice(0, 8).map((ing, i) => {
                          const name = typeof ing === 'string' ? ing : ing.name;
                          const matched = selectedIngredients.some(s => name?.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(name?.toLowerCase()));
                          return (
                            <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${matched?'bg-[#EDF7E7] text-sage':'bg-slate-100 text-slate-500'}`}>
                              {name}{typeof ing === 'object' && ing.grams ? ` ${ing.grams}g` : ''}
                            </span>
                          );
                        })}
                        {(recipe.ingredients || []).length > 8 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">+{recipe.ingredients.length - 8}개</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
