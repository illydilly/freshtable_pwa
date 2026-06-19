import { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

const emptyNutrition = { name:'', calories:'', carbs:'', protein:'', fat:'', sodium:'', sugar:'' };
const mealTypes = ['아침', '점심', '저녁', '간식'];

function normalizeNutrition(food) {
  return { name:food?.name||'', calories:Number(food?.calories)||0, carbs:Number(food?.carbs)||0, protein:Number(food?.protein)||0, fat:Number(food?.fat)||0, sodium:Number(food?.sodium)||0, sugar:Number(food?.sugar)||0 };
}

const today = () => new Date().toISOString().slice(0, 10);

export function NutritionPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [publicResults, setPublicResults] = useState([]);
  const [apiKeyword, setApiKeyword] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // #4, #5: 식단일기 추가 modal
  const [diaryModal, setDiaryModal] = useState(false);
  const [diaryTarget, setDiaryTarget] = useState(null); // { id, name, calories }
  const [diaryDates, setDiaryDates] = useState([today()]);
  const [diaryMealTypes, setDiaryMealTypes] = useState(['아침']);
  const [savingDiary, setSavingDiary] = useState(false);
  const [diarySuccess, setDiarySuccess] = useState('');

  const { register, handleSubmit, reset, setValue } = useForm({ defaultValues: emptyNutrition });

  const fetchItems = async (search='') => { const r = await api.get('/nutrition', { params: search?{query:search}:{} }); setItems(r.data); };
  useEffect(() => { fetchItems(); }, []);

  const fillForm = (food) => { const v=normalizeNutrition(food); Object.entries(v).forEach(([k,val])=>setValue(k,val)); return v; };

  const openModal = (food=null) => {
    reset(emptyNutrition); setApiKeyword(''); setApiResults([]); setApiMessage(''); setIsModalOpen(true);
    if (food) { const v=normalizeNutrition(food); setTimeout(()=>{ Object.entries(v).forEach(([k,val])=>setValue(k,val)); setApiMessage(`${v.name||'선택한 식재료'} 정보를 입력칸에 채웠습니다.`); },0); }
  };
  const closeModal = () => { setIsModalOpen(false); setApiKeyword(''); setApiResults([]); setApiMessage(''); reset(emptyNutrition); };
  const onSubmit = async (values) => { await api.post('/nutrition', values); closeModal(); fetchItems(query); };

  const searchPublicFoods = async (keyword, { setModalResults=false }={}) => {
    if (!keyword.trim()) { setApiMessage('검색어를 입력해 주세요.'); return []; }
    setIsApiLoading(true); setApiMessage('');
    try {
      const r = await api.get('/search-food', { params: { keyword:keyword.trim() } });
      if (setModalResults) setApiResults(r.data); else setPublicResults(r.data);
      setApiMessage(r.data.length>0?'검색 결과를 클릭하면 입력칸이 자동으로 채워집니다.':'공공 검색 결과가 없습니다.');
      return r.data;
    } catch(err) {
      const msg = err.response?.data?.error||'식재료 정보를 가져오지 못했습니다.';
      setApiMessage(msg); if(setModalResults) setApiResults([]); else setPublicResults([]); return [];
    } finally { setIsApiLoading(false); }
  };

  const handleMainSearch = async () => { const kw=query.trim(); await fetchItems(kw); await searchPublicFoods(kw); };
  const handleApiSearch = async () => { await searchPublicFoods(apiKeyword, { setModalResults:true }); };
  const handleSelectApiFood = (food) => { const v=fillForm(food); setApiMessage(`${v.name||'선택한 식재료'} 정보를 입력칸에 채웠습니다. 확인 후 저장해 주세요.`); };

  // #4: 식단일기 추가 버튼 클릭
  const openDiaryModal = (item) => {
    setDiaryTarget(item); setDiaryDates([today()]); setDiaryMealTypes(['아침']); setDiarySuccess(''); setDiaryModal(true);
  };

  // #5: 날짜 추가/삭제
  const addDiaryDate = () => setDiaryDates(d=>[...d,'']);
  const updateDiaryDate = (i,v) => setDiaryDates(d=>d.map((x,idx)=>idx===i?v:x));
  const removeDiaryDate = (i) => setDiaryDates(d=>d.filter((_,idx)=>idx!==i));

  // #5: 식사시점 다중 선택 (toggle)
  const toggleMealType = (type) => setDiaryMealTypes(prev=>prev.includes(type)?prev.filter(t=>t!==type):[...prev,type]);

  const submitDiary = async () => {
    if (!diaryDates.filter(d=>d).length || !diaryMealTypes.length) return;
    setSavingDiary(true);
    try {
      const pairs = diaryDates.filter(d=>d).flatMap(date => diaryMealTypes.map(mealType => ({ date, mealType })));
      // #11: 영양정보를 mealItems에 포함해서 식단일기에 저장
      const nutritionItem = diaryTarget ? [{
        type: 'nutrition',
        name: diaryTarget.name,
        calories: diaryTarget.calories || 0,
        carbs: diaryTarget.carbs || 0,
        protein: diaryTarget.protein || 0,
        fat: diaryTarget.fat || 0,
        sodium: diaryTarget.sodium || 0,
        sugar: diaryTarget.sugar || 0
      }] : [];
      await Promise.all(pairs.map(({ date, mealType }) => {
        const formData = new FormData();
        formData.append('date', date);
        formData.append('mealType', mealType);
        formData.append('diaryText', diaryTarget.name);
        if (nutritionItem.length > 0) {
          formData.append('mealItems', JSON.stringify(nutritionItem));
        }
        return api.post('/meal-diaries', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }));
      setDiarySuccess(`${pairs.length}개 식단일기에 추가되었습니다.`);
      setTimeout(() => { setDiaryModal(false); setDiarySuccess(''); }, 2000);
    } finally { setSavingDiary(false); }
  };

  return (
    <div className="relative">
      <PageHeader title="영양정보 검색" subtitle="식재료의 100g 기준 영양정보를 검색하고 저장할 수 있습니다."
        action={<button type="button" onClick={()=>openModal()} className="inline-flex items-center gap-2 rounded-2xl bg-sage px-5 py-3 font-semibold text-white shadow-sm"><Plus size={20}/> 식재료 추가</button>}
      />

      <section className="soft-card p-6">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={query} onChange={e=>{ setQuery(e.target.value); fetchItems(e.target.value); }} onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();handleMainSearch();}}} placeholder="예: 바나나, 사과, 된장국" className="input-base pl-11"/>
          </div>
          <button type="button" onClick={handleMainSearch} disabled={isApiLoading} className="rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-60">{isApiLoading?'검색중':'검색'}</button>
        </div>
        {apiMessage && <div className="mt-4 rounded-2xl bg-[#F8FAF7] px-4 py-3 text-sm text-slate-500">{apiMessage}</div>}
        {publicResults.length>0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white">
            {publicResults.map((food,i)=>(
              <button key={`${food.name}-${i}`} type="button" onClick={()=>openModal(food)} className="block w-full border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-[#F8FAF7]">
                <span className="font-bold text-slate-900">{food.name||'이름 없음'}</span><span className="ml-2 font-semibold text-sage">{food.calories||0}kcal</span>
                <span className="mt-1 block text-xs text-slate-400">탄수화물 {food.carbs||0}g · 단백질 {food.protein||0}g · 지방 {food.fat||0}g · 나트륨 {food.sodium||0}mg</span>
              </button>
            ))}
          </div>
        )}

        {/* #4: 저장된 영양정보 카드 + 식단일기 추가 버튼 */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map(item=>(
            <div key={item.id} className="rounded-[24px] border border-border bg-white p-5 shadow-sm flex flex-col">
              <div className="font-bold text-slate-900">{item.name}</div>
              <div className="mt-3 text-3xl font-extrabold text-sage">{item.calories}<span className="ml-2 text-sm font-semibold text-slate-400">kcal</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-500">
                <div>탄수화물 <span className="font-semibold text-slate-900">{item.carbs}g</span></div>
                <div>단백질 <span className="font-semibold text-slate-900">{item.protein}g</span></div>
                <div>지방 <span className="font-semibold text-slate-900">{item.fat}g</span></div>
                <div>당류 <span className="font-semibold text-slate-900">{item.sugar}g</span></div>
                <div className="col-span-2">나트륨 <span className="font-semibold text-slate-900">{item.sodium}mg</span></div>
              </div>
              {/* #11: 식단에 추가 버튼 */}
              <button type="button" onClick={()=>openDiaryModal(item)} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#EDF7E7] py-2.5 text-sm font-semibold text-sage hover:bg-sage hover:text-white transition-colors">
                <BookOpen size={14}/> 식단에 추가
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 영양정보 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal}/>
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-100 bg-white p-6 shadow-2xl">
            <button type="button" onClick={closeModal} className="absolute right-6 top-6 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={20}/></button>
            <h2 className="text-xl font-bold text-slate-900">식재료 영양정보 등록</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">식재료를 검색한 뒤 결과를 클릭하면 아래 입력칸이 자동으로 채워집니다.</p>
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="mb-2 block text-xs font-bold text-slate-500">공공 식품영양정보 검색</label>
              <div className="flex gap-2">
                <input value={apiKeyword} onChange={e=>setApiKeyword(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();handleApiSearch();}}} placeholder="예: 바나나, 닭가슴살" className="input-base bg-white"/>
                <button type="button" onClick={handleApiSearch} disabled={isApiLoading} className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{isApiLoading?'검색중':'검색'}</button>
              </div>
              {apiMessage && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-500">{apiMessage}</p>}
              {apiResults.length>0 && (
                <ul className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  {apiResults.map((food,i)=>(
                    <li key={`${food.name}-${i}`}>
                      <button type="button" onClick={()=>handleSelectApiFood(food)} className="block w-full border-b border-slate-100 p-3 text-left text-xs text-slate-700 last:border-b-0 hover:bg-slate-50">
                        <span className="font-bold text-slate-900">{food.name||'이름 없음'}</span><span className="ml-2 font-semibold text-sage">{food.calories||0}kcal</span>
                        <span className="mt-1 block text-slate-400">탄수화물 {food.carbs||0}g · 단백질 {food.protein||0}g · 지방 {food.fat||0}g</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">식재료 이름</label><input {...register('name',{required:true})} className="input-base" placeholder="식재료명을 입력하세요"/></div>
              <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">칼로리(100g 기준)</label><input {...register('calories')} className="input-base" placeholder="kcal" type="number"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">탄수화물 (g)</label><input {...register('carbs')} className="input-base" type="number" step="0.01"/></div>
                <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">단백질 (g)</label><input {...register('protein')} className="input-base" type="number" step="0.01"/></div>
                <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">지방 (g)</label><input {...register('fat')} className="input-base" type="number" step="0.01"/></div>
                <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">당류 (g)</label><input {...register('sugar')} className="input-base" type="number" step="0.01"/></div>
              </div>
              <div><label className="mb-1 block pl-1 text-xs font-bold text-slate-400">나트륨 (mg)</label><input {...register('sodium')} className="input-base" type="number" step="0.01"/></div>
              <button type="submit" className="w-full rounded-2xl bg-sage px-5 py-3 font-semibold text-white">영양정보 저장</button>
            </form>
          </div>
        </div>
      )}

      {/* #4, #5: 식단일기 추가 모달 */}
      <Modal open={diaryModal} onClose={()=>setDiaryModal(false)} title={`식단에 추가 — ${diaryTarget?.name||''}`} className="max-w-lg">
        <div className="space-y-5">
          {diarySuccess ? (
            <div className="rounded-2xl bg-[#EDF7E7] px-4 py-4 text-center text-sm font-semibold text-sage">{diarySuccess}</div>
          ) : (
            <>
              {/* #5: 날짜 다중 선택 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">날짜 (여러 날짜 가능)</label>
                  <button type="button" onClick={addDiaryDate} className="rounded-xl bg-[#EDF7E7] px-3 py-1 text-xs font-semibold text-sage">+ 날짜 추가</button>
                </div>
                <div className="space-y-2">
                  {diaryDates.map((d,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" className="input-base flex-1" value={d} onChange={e=>updateDiaryDate(i,e.target.value)}/>
                      {diaryDates.length>1 && <button type="button" onClick={()=>removeDiaryDate(i)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={14}/></button>}
                    </div>
                  ))}
                </div>
              </div>
              {/* #5: 식사시점 다중 선택 */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">식사 시점 (중복 선택 가능)</label>
                <div className="flex flex-wrap gap-2">
                  {mealTypes.map(type=>(
                    <button key={type} type="button" onClick={()=>toggleMealType(type)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${diaryMealTypes.includes(type)?'bg-sage text-white':'bg-slate-100 text-slate-600 hover:bg-[#EDF7E7]'}`}>
                      {type}
                    </button>
                  ))}
                </div>
                {diaryMealTypes.length>0 && <p className="mt-2 text-xs text-slate-400">선택: {diaryMealTypes.join(', ')}</p>}
              </div>
              <div className="rounded-2xl bg-[#F8FAF7] p-3 text-sm text-slate-500">
                총 <strong className="text-sage">{diaryDates.filter(d=>d).length * diaryMealTypes.length}개</strong> 식단일기가 등록됩니다.
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setDiaryModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
                <button type="button" onClick={submitDiary} disabled={savingDiary||!diaryDates.filter(d=>d).length||!diaryMealTypes.length}
                  className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">
                  {savingDiary?'추가 중...':'식단일기에 추가'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
