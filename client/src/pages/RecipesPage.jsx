import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, Edit2, Plus, Search, Star, Wrench, X } from 'lucide-react';
import { NutritionAutoCalc } from '../components/NutritionAutoCalc';
import { useSearchParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/utils';

const colors = ['#7FB069', '#A8CE95', '#DCEACF'];

function localRecipeToResult(r) { return { ...r, source:'saved', resultKey:`saved-${r.id}` }; }
function publicRecipeToResult(r, i) { return { ...r, id:null, source:'public', resultKey:`public-${r.name}-${i}` }; }

const emptyForm = {
  name:'', cookingTime:30, satisfaction:5, calories:0, carbs:0, protein:0, fat:0, sodium:0, sugar:0
};

export function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [keyword, setKeyword] = useState('');
  const [publicRecipes, setPublicRecipes] = useState([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // #12: 레시피 추가 모달
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addIngredients, setAddIngredients] = useState([{ name:'', grams:'' }]);
  const [addSteps, setAddSteps] = useState(['']);
  const [addTools, setAddTools] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editIngredients, setEditIngredients] = useState([]);
  const [editSteps, setEditSteps] = useState([]);
  const [editTools, setEditTools] = useState([]);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const loadRecipes = () => api.get('/recipes').then(res => {
    const recipeIdFromUrl = Number(searchParams.get('recipe')) || null;
    setRecipes(res.data);
    setSelectedKey(recipeIdFromUrl ? `saved-${recipeIdFromUrl}` : res.data[0] ? `saved-${res.data[0].id}` : '');
  });

  useEffect(() => { loadRecipes(); }, []);

  useEffect(() => {
    const id = Number(searchParams.get('recipe')) || null;
    if (id && selectedKey !== `saved-${id}`) setSelectedKey(`saved-${id}`);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedKey.startsWith('saved-')) return;
    const id = selectedKey.replace('saved-', '');
    const cur = searchParams.get('recipe');
    if (String(cur) === String(id)) return;
    const next = new URLSearchParams(searchParams); next.set('recipe', String(id)); setSearchParams(next);
  }, [selectedKey]);

  const savedResults = useMemo(() => recipes.map(localRecipeToResult), [recipes]);
  const visibleSaved = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return kw ? savedResults.filter(r => r.name.toLowerCase().includes(kw)) : savedResults;
  }, [savedResults, keyword]);
  const publicResults = useMemo(() => publicRecipes.map(publicRecipeToResult), [publicRecipes]);
  const results = useMemo(() => [...visibleSaved, ...publicResults], [visibleSaved, publicResults]);
  const recipe = useMemo(() => results.find(r => r.resultKey === selectedKey) || null, [results, selectedKey]);
  const macrosData = useMemo(() => recipe ? [
    { name:'탄수화물', value:Number(recipe.carbs)||0 },
    { name:'단백질', value:Number(recipe.protein)||0 },
    { name:'지방', value:Number(recipe.fat)||0 }
  ].filter(i=>i.value>0) : [], [recipe]);

  const handleSearch = async () => {
    const trimmed = keyword.trim();
    setSearchMessage(''); setPublicRecipes([]);
    if (!trimmed) { setSearchMessage('검색어를 입력하면 저장된 레시피와 공공 조리식품 정보를 함께 찾습니다.'); return; }
    setSearching(true);
    try {
      const res = await api.get('/search-cooked-recipes', { params:{ keyword:trimmed } });
      setPublicRecipes(res.data);
      setSearchMessage(res.data.length>0?'저장된 레시피와 공공 조리식품 검색 결과를 함께 표시합니다.':'공공 조리식품 검색 결과가 없습니다.');
      if (res.data.length>0 && visibleSaved.length===0) setSelectedKey(`public-${res.data[0].name}-0`);
    } catch(err) { setSearchMessage(err.response?.data?.error||'공공 조리식품 검색에 실패했습니다.'); }
    finally { setSearching(false); }
  };

  // #12: 레시피 저장
  const openAddModal = () => {
    setAddForm(emptyForm); setAddIngredients([{name:'',grams:''}]); setAddSteps(['']); setAddTools([]); setSaveError(''); setAddModal(true);
  };

  const submitAdd = async () => {
    if (!addForm.name.trim()) { setSaveError('레시피 이름을 입력해 주세요.'); return; }
    setSaving(true); setSaveError('');
    try {
      const ingredients = addIngredients.filter(i=>i.name.trim()).map(i=>({ name:i.name.trim(), grams:Number(i.grams)||0 }));
      const steps = addSteps.filter(s=>s.trim());
      const cookingTools = addTools.filter(t=>t.trim()); // #13: 조리도구 배열
      await api.post('/recipes', {
        ...addForm,
        cookingTime: Number(addForm.cookingTime)||30,
        satisfaction: Number(addForm.satisfaction)||5,
        calories: Number(addForm.calories)||0,
        carbs: Number(addForm.carbs)||0,
        protein: Number(addForm.protein)||0,
        fat: Number(addForm.fat)||0,
        sodium: Number(addForm.sodium)||0,
        sugar: Number(addForm.sugar)||0,
        ingredients, steps, cookingTools, // #13
        eatenDates: []
      });
      setAddModal(false);
      await loadRecipes();
    } catch(err) { setSaveError(err.response?.data?.message||'레시피 저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  // #8: 레시피 수정 모달 열기
  const openEditRecipe = (r) => {
    setEditForm({
      name: r.name,
      cookingTime: r.cookingTime,
      satisfaction: r.satisfaction,
      calories: r.calories,
      carbs: r.carbs,
      protein: r.protein,
      fat: r.fat,
      sodium: r.sodium,
      sugar: r.sugar,
      _id: r.id
    });
    setEditIngredients(
      (r.ingredients || []).map(i => typeof i === 'string' ? { name: i, grams: '' } : { name: i.name || '', grams: i.grams || '' })
    );
    setEditSteps(r.steps?.length ? r.steps : ['']);
    setEditTools(r.cookingTools || []);
    setEditPhotoFile(null);
    setEditPhotoPreview(r.thumbnailUrl || null);
    setEditError('');
    setEditModal(true);
  };

  // #8: 레시피 수정 저장
  const submitEditRecipe = async () => {
    if (!editForm.name?.trim()) { setEditError('레시피 이름을 입력해 주세요.'); return; }
    setSavingEdit(true); setEditError('');
    try {
      const formData = new FormData();
      formData.append('name', editForm.name.trim());
      formData.append('cookingTime', String(editForm.cookingTime || 30));
      formData.append('satisfaction', String(editForm.satisfaction || 5));
      formData.append('calories', String(editForm.calories || 0));
      formData.append('carbs', String(editForm.carbs || 0));
      formData.append('protein', String(editForm.protein || 0));
      formData.append('fat', String(editForm.fat || 0));
      formData.append('sodium', String(editForm.sodium || 0));
      formData.append('sugar', String(editForm.sugar || 0));
      const ings = editIngredients.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), grams: Number(i.grams) || 0 }));
      formData.append('ingredients', JSON.stringify(ings));
      formData.append('steps', JSON.stringify(editSteps.filter(s => s.trim())));
      formData.append('cookingTools', JSON.stringify(editTools.filter(t => t.trim())));
      formData.append('eatenDates', JSON.stringify([]));
      if (editPhotoFile) formData.append('photo', editPhotoFile);
      await api.put(`/recipes/${editForm._id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditModal(false);
      await loadRecipes();
    } catch (err) { setEditError(err.response?.data?.message || '수정에 실패했습니다.'); }
    finally { setSavingEdit(false); }
  };

  return (
    <div>
      <PageHeader title="식단 레시피 및 영양 구성 도감" subtitle="저장된 레시피와 공공 조리식품 영양정보를 함께 검색합니다."
        action={
          // #12: 레시피 추가 버튼
          <button onClick={openAddModal} className="flex items-center gap-2 rounded-2xl bg-sage px-5 py-3 font-semibold text-white shadow-sm hover:bg-opacity-90">
            <Plus size={18}/> 레시피 추가
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="soft-card flex h-[620px] flex-col p-6">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleSearch();}}} className="input-base pl-11" placeholder="예: 찌개, 된장국, 비빔밥"/>
            </div>
            <button onClick={handleSearch} disabled={searching} className="rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{searching?'검색중':'검색'}</button>
          </div>
          {searchMessage && <div className="mt-3 rounded-2xl bg-[#F8FAF7] px-4 py-3 text-xs leading-5 text-slate-500">{searchMessage}</div>}
          <div className="mt-4 flex-1 overflow-y-auto divide-y divide-border pr-1">
            {results.length===0 ? (
              <div className="py-8 text-center text-sm text-slate-400">일치하는 메뉴가 없습니다.</div>
            ) : results.map(item=>(
              <button key={item.resultKey} onClick={()=>setSelectedKey(item.resultKey)}
                className={`flex w-full items-center gap-4 py-4 text-left transition-all ${item.resultKey===selectedKey?'opacity-100 font-bold text-sage':'opacity-70'}`}>
                {item.thumbnail ? <img src={item.thumbnail} alt={item.name} className="h-16 w-20 rounded-2xl object-cover"/> : <div className="flex h-16 w-20 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage"><ChefHat size={22}/></div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base text-slate-900">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.source==='public'?'공공 조리식품':'저장된 레시피'} · {item.calories||0} kcal</div>
                  {item.cookingTools?.length > 0 && <div className="mt-1 text-xs text-slate-400">🔧 {item.cookingTools.slice(0,3).join(', ')}{item.cookingTools.length>3?` +${item.cookingTools.length-3}개`:''}</div>}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6 lg:col-span-2">
          {!recipe ? (
            <div className="soft-card flex h-[300px] items-center justify-center p-6 text-slate-400">왼쪽 목록에서 메뉴를 고르면 상세 정보가 표시됩니다.</div>
          ) : (
            <>
              <div className="soft-card overflow-hidden">
                <div className="relative h-56 w-full bg-[#EDF7E7]">
                  {(recipe.thumbnailUrl||recipe.thumbnail) ? (
                    <img src={recipe.thumbnailUrl||recipe.thumbnail} alt="" className="h-full w-full object-cover"/>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sage"><ChefHat size={48}/></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>
                  {/* #8: 수정 버튼 - 우측 상단에 명확하게 */}
                  {recipe.source === 'saved' && (
                    <button onClick={() => openEditRecipe(recipe)}
                      className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-md hover:bg-sage hover:text-white transition-all">
                      <Edit2 size={13}/> 수정
                    </button>
                  )}
                  <div className="absolute bottom-6 left-6 text-white">
                    <div className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{recipe.source==='public'?'공공 조리식품':'저장된 레시피'}</div>
                    <h2 className="text-3xl font-black">{recipe.name}</h2>
                    <p className="mt-2 text-sm opacity-90">{recipe.calories||0} kcal{recipe.satisfaction?` · 만족도 ${recipe.satisfaction}점`:''}</p>
                  </div>
                </div>
                <div className="grid gap-6 p-6 md:grid-cols-2">
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><ChefHat size={18} className="text-sage"/> 준비 재료</div>
                    <div className="divide-y divide-border rounded-2xl border border-border bg-[#FCFCFC] px-4">
                      {recipe.ingredientsText ? (
                        <div className="py-3 text-sm leading-6 text-slate-600">{recipe.ingredientsText}</div>
                      ) : (recipe.ingredients||[]).length>0 ? (
                        recipe.ingredients.map((ing,i)=>(
                          <div key={i} className="flex items-center justify-between py-3 text-sm">
                            <span className="font-medium text-slate-700">{typeof ing==='string'?ing:ing.name}</span>
                            {typeof ing==='object'&&ing.grams>0 && <span className="font-semibold text-slate-500">{ing.grams}g</span>}
                          </div>
                        ))
                      ) : <div className="py-3 text-sm text-slate-400">재료 정보가 없습니다.</div>}
                    </div>
                  </section>
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><Clock3 size={18} className="text-sage"/> 조리 순서</div>
                    <div className="space-y-3">
                      {(recipe.steps||[]).length>0 ? (
                        recipe.steps.map((step,i)=>(
                          <div key={i} className="flex gap-3 text-sm leading-6">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDF7E7] text-xs font-bold text-sage">{i+1}</span>
                            <span className="text-slate-600">{step}</span>
                          </div>
                        ))
                      ) : <div className="text-sm text-slate-400">조리 순서 정보가 없습니다.</div>}
                    </div>
                    {/* #13: 조리도구 표시 (없으면 #14: 모든 재료 포함 안내) */}
                    {recipe.source==='saved' && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Wrench size={14}/> 사용 조리도구</div>
                        {recipe.cookingTools?.length>0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {recipe.cookingTools.map((t,i)=><span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{t}</span>)}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">조리도구 미등록 — 추천 시 모든 재료를 태그로 활용합니다.</div>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <section className="soft-card p-6 md:col-span-2">
                  <div className="text-xl font-bold text-slate-900">3대 영양소 밸런스</div>
                  <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
                    <div className="h-44 w-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={macrosData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                          {macrosData.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}
                        </Pie></PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-2">
                      {[['탄수화물',recipe.carbs,'g'],['단백질',recipe.protein,'g'],['지방',recipe.fat,'g'],['나트륨',recipe.sodium,'mg'],['당류',recipe.sugar,'g']].map(([l,v,u])=>(
                        <div key={l} className="flex items-center justify-between rounded-2xl bg-[#FCFCFC] px-4 py-3"><span>{l}</span><span className="font-bold text-slate-900">{v||0}{u}</span></div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="soft-card p-6">
                  <div className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900"><Star size={20} className="text-[#EBAA1E]"/> 먹은 날짜</div>
                  <div className="flex flex-wrap gap-3">
                    {(recipe.eatenDates||[]).length===0 ? <span className="text-sm text-slate-500">아직 기록된 날짜가 없어요.</span>
                      : recipe.eatenDates.map(d=><span key={d} className="rounded-full border border-border bg-[#FCFCFC] px-4 py-2 text-sm font-semibold text-slate-600">{formatDate(d,'MM.dd')}</span>)}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>

      {/* #8: 레시피 수정 모달 */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title="레시피 수정" className="max-w-2xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {editError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{editError}</div>}

          {/* 사진 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">레시피 사진</label>
            <div className="flex items-center gap-4">
              {(editPhotoPreview) && (
                <img src={editPhotoFile ? URL.createObjectURL(editPhotoFile) : editPhotoPreview} alt="preview"
                  className="h-24 w-24 rounded-2xl object-cover border border-border flex-shrink-0"/>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-sage hover:text-sage transition-colors">
                <Plus size={16}/> 사진 변경
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setEditPhotoFile(f); setEditPhotoPreview(URL.createObjectURL(f)); }
                }}/>
              </label>
              {editPhotoPreview && (
                <button type="button" onClick={()=>{setEditPhotoFile(null);setEditPhotoPreview(null);}}
                  className="rounded-xl bg-[#FFF0F0] px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white transition-colors">
                  사진 삭제
                </button>
              )}
            </div>
          </div>

          <div><label className="mb-1 block text-xs font-bold text-slate-500">레시피 이름 *</label><input className="input-base" value={editForm.name||''} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">조리시간(분)</label><input type="number" className="input-base" value={editForm.cookingTime||30} onChange={e=>setEditForm(p=>({...p,cookingTime:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">만족도(1~5)</label><input type="number" min="1" max="5" className="input-base" value={editForm.satisfaction||5} onChange={e=>setEditForm(p=>({...p,satisfaction:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">칼로리(kcal)</label><input type="number" className="input-base" value={editForm.calories||0} onChange={e=>setEditForm(p=>({...p,calories:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">탄수화물(g)</label><input type="number" step="0.01" className="input-base" value={editForm.carbs||0} onChange={e=>setEditForm(p=>({...p,carbs:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">단백질(g)</label><input type="number" step="0.01" className="input-base" value={editForm.protein||0} onChange={e=>setEditForm(p=>({...p,protein:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">지방(g)</label><input type="number" step="0.01" className="input-base" value={editForm.fat||0} onChange={e=>setEditForm(p=>({...p,fat:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">나트륨(mg)</label><input type="number" step="0.01" className="input-base" value={editForm.sodium||0} onChange={e=>setEditForm(p=>({...p,sodium:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">당류(g)</label><input type="number" step="0.01" className="input-base" value={editForm.sugar||0} onChange={e=>setEditForm(p=>({...p,sugar:e.target.value}))}/></div>
          </div>

          {/* 재료 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">사용 재료</label>
              <button type="button" onClick={()=>setEditIngredients(p=>[...p,{name:'',grams:''}])} className="rounded-lg bg-[#EDF7E7] px-2.5 py-1 text-xs font-semibold text-sage">+ 재료 추가</button>
            </div>
            {editIngredients.map((ing,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <input className="input-base flex-1 text-sm" placeholder="재료명" value={ing.name} onChange={e=>setEditIngredients(p=>p.map((x,idx)=>idx===i?{...x,name:e.target.value}:x))}/>
                <input className="input-base w-20 text-sm" placeholder="g" type="number" value={ing.grams} onChange={e=>setEditIngredients(p=>p.map((x,idx)=>idx===i?{...x,grams:e.target.value}:x))}/>
                {editIngredients.length>1 && <button type="button" onClick={()=>setEditIngredients(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>}
              </div>
            ))}
          </div>

          {/* ✨ 영양정보 자동 계산 (EDIT) */}
          <NutritionAutoCalc
            ingredients={editIngredients}
            onResult={nut => setEditForm(p => ({
              ...p,
              calories: nut.calories,
              carbs: nut.carbs,
              protein: nut.protein,
              fat: nut.fat,
              sodium: nut.sodium,
              sugar: nut.sugar,
            }))}
          />

          {/* 조리도구 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">사용 조리도구 <span className="text-xs font-normal text-slate-400">(미입력 시 모든 재료가 태그로 사용됨)</span></label>
              <button type="button" onClick={()=>setEditTools(p=>[...p,''])} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">+ 도구 추가</button>
            </div>
            {editTools.length===0 && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">미입력 — 추천 시 모든 재료를 태그로 활용</div>}
            {editTools.map((tool,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <input className="input-base flex-1 text-sm" placeholder="예: 냄비, 프라이팬" value={tool} onChange={e=>setEditTools(p=>p.map((x,idx)=>idx===i?e.target.value:x))}/>
                <button type="button" onClick={()=>setEditTools(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>
              </div>
            ))}
          </div>

          {/* 조리 순서 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">조리 순서</label>
              <button type="button" onClick={()=>setEditSteps(p=>[...p,''])} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">+ 단계 추가</button>
            </div>
            {editSteps.map((step,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#EDF7E7] text-xs font-bold text-sage">{i+1}</span>
                <input className="input-base flex-1 text-sm" placeholder={`${i+1}번째 단계`} value={step} onChange={e=>setEditSteps(p=>p.map((x,idx)=>idx===i?e.target.value:x))}/>
                {editSteps.length>1 && <button type="button" onClick={()=>setEditSteps(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setEditModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button type="button" onClick={submitEditRecipe} disabled={savingEdit} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">{savingEdit?'저장 중...':'수정 저장'}</button>
          </div>
        </div>
      </Modal>

      {/* #12, #13: 레시피 추가 모달 */}
      <Modal open={addModal} onClose={()=>setAddModal(false)} title="레시피 추가" className="max-w-2xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {saveError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{saveError}</div>}
          <div><label className="mb-1 block text-xs font-bold text-slate-500">레시피 이름 *</label><input className="input-base" value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">조리시간(분)</label><input type="number" className="input-base" value={addForm.cookingTime} onChange={e=>setAddForm(p=>({...p,cookingTime:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">만족도(1~5)</label><input type="number" min="1" max="5" className="input-base" value={addForm.satisfaction} onChange={e=>setAddForm(p=>({...p,satisfaction:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">칼로리(kcal)</label><input type="number" step="0.01" className="input-base" value={addForm.calories} onChange={e=>setAddForm(p=>({...p,calories:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">탄수화물(g)</label><input type="number" step="0.01" className="input-base" value={addForm.carbs} onChange={e=>setAddForm(p=>({...p,carbs:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">단백질(g)</label><input type="number" step="0.01" className="input-base" value={addForm.protein} onChange={e=>setAddForm(p=>({...p,protein:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">지방(g)</label><input type="number" step="0.01" className="input-base" value={addForm.fat} onChange={e=>setAddForm(p=>({...p,fat:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">나트륨(mg)</label><input type="number" step="0.01" className="input-base" value={addForm.sodium} onChange={e=>setAddForm(p=>({...p,sodium:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">당류(g)</label><input type="number" step="0.01" className="input-base" value={addForm.sugar} onChange={e=>setAddForm(p=>({...p,sugar:e.target.value}))}/></div>
          </div>

          {/* #13: 사용 재료 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">사용 재료</label>
              <button type="button" onClick={()=>setAddIngredients(p=>[...p,{name:'',grams:''}])} className="rounded-lg bg-[#EDF7E7] px-2.5 py-1 text-xs font-semibold text-sage">+ 재료 추가</button>
            </div>
            {addIngredients.map((ing,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <input className="input-base flex-1 text-sm" placeholder="재료명" value={ing.name} onChange={e=>setAddIngredients(p=>p.map((x,idx)=>idx===i?{...x,name:e.target.value}:x))}/>
                <input className="input-base w-20 text-sm" placeholder="g" type="number" value={ing.grams} onChange={e=>setAddIngredients(p=>p.map((x,idx)=>idx===i?{...x,grams:e.target.value}:x))}/>
                {addIngredients.length>1&&<button type="button" onClick={()=>setAddIngredients(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>}
              </div>
            ))}
          </div>

          {/* ✨ 영양정보 자동 계산 (ADD) */}
          <NutritionAutoCalc
            ingredients={addIngredients}
            onResult={nut => setAddForm(p => ({
              ...p,
              calories: nut.calories,
              carbs: nut.carbs,
              protein: nut.protein,
              fat: nut.fat,
              sodium: nut.sodium,
              sugar: nut.sugar,
            }))}
          />

          {/* #13: 사용 조리도구 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700">사용 조리도구</label>
                <span className="ml-2 text-xs text-slate-400">(미입력 시 모든 재료가 태그로 사용됩니다 — #14)</span>
              </div>
              <button type="button" onClick={()=>setAddTools(p=>[...p,''])} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">+ 도구 추가</button>
            </div>
            {addTools.length===0 && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">조리도구를 추가하지 않으면 추천 시 모든 재료를 태그로 활용합니다.</div>}
            {addTools.map((tool,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <input className="input-base flex-1 text-sm" placeholder="예: 냄비, 프라이팬, 에어프라이어" value={tool} onChange={e=>setAddTools(p=>p.map((x,idx)=>idx===i?e.target.value:x))}/>
                <button type="button" onClick={()=>setAddTools(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>
              </div>
            ))}
          </div>

          {/* #13: 조리 순서 행 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">조리 순서</label>
              <button type="button" onClick={()=>setAddSteps(p=>[...p,''])} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">+ 단계 추가</button>
            </div>
            {addSteps.map((step,i)=>(
              <div key={i} className="mb-2 flex gap-2 items-center">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#EDF7E7] text-xs font-bold text-sage">{i+1}</span>
                <input className="input-base flex-1 text-sm" placeholder={`${i+1}번째 조리 단계`} value={step} onChange={e=>setAddSteps(p=>p.map((x,idx)=>idx===i?e.target.value:x))}/>
                {addSteps.length>1&&<button type="button" onClick={()=>setAddSteps(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setAddModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button type="button" onClick={submitAdd} disabled={saving} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">{saving?'저장 중...':'레시피 저장'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
