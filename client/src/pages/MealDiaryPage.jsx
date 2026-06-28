import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMonths } from 'date-fns/addMonths';
import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { endOfMonth } from 'date-fns/endOfMonth';
import { endOfWeek } from 'date-fns/endOfWeek';
import { format } from 'date-fns/format';
import { isSameMonth } from 'date-fns/isSameMonth';
import { isAfter } from 'date-fns/isAfter';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { subMonths } from 'date-fns/subMonths';
import { ko } from 'date-fns/locale/ko';
import { isToday } from 'date-fns/isToday';
import { Camera, ChefHat, ChevronLeft, ChevronRight, CropIcon, Download, Loader2, Plus, Search, UtensilsCrossed, Utensils, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { NutritionAutoCalc } from '../components/NutritionAutoCalc';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { formatCurrency, getMealSlotTone } from '../lib/utils';

const mealTypes = ['아침', '점심', '저녁', '간식'];
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ── 이미지 크롭 ────────────────────────────────────────────────────────────
function ImageCropper({ src, onCrop, onCancel }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [crop, setCrop] = useState({ x:0, y:0, w:0, h:0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const getPos = (e, el) => {
    const r = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x:((cx-r.left)/r.width)*100, y:((cy-r.top)/r.height)*100 };
  };
  const onDown = e => { e.preventDefault(); const p=getPos(e,containerRef.current); setDragging(true); setDragStart(p); setCrop({x:p.x,y:p.y,w:0,h:0}); };
  const onMove = useCallback(e => {
    if (!dragging || !dragStart) return; e.preventDefault();
    const p = getPos(e, containerRef.current);
    setCrop({ x:Math.max(0,Math.min(dragStart.x,p.x)), y:Math.max(0,Math.min(dragStart.y,p.y)), w:Math.abs(p.x-dragStart.x), h:Math.abs(p.y-dragStart.y) });
  }, [dragging, dragStart]);
  const onUp = () => setDragging(false);
  const confirm = () => {
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    const s=2;
    canvas.width=(crop.w/100)*img.naturalWidth*s; canvas.height=(crop.h/100)*img.naturalHeight*s;
    canvas.getContext('2d').drawImage(img,(crop.x/100)*img.naturalWidth,(crop.y/100)*img.naturalHeight,(crop.w/100)*img.naturalWidth,(crop.h/100)*img.naturalHeight,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob => { if(blob) onCrop(new File([blob],'cropped.jpg',{type:'image/jpeg'})); }, 'image/jpeg', 0.9);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">드래그하여 자를 영역을 선택하세요.</p>
      <div ref={containerRef} className="relative cursor-crosshair overflow-hidden rounded-2xl border-2 border-sage select-none"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
        <img ref={imgRef} src={src} alt="crop" className="w-full h-auto block pointer-events-none"/>
        <div className="absolute inset-0 bg-black/40 pointer-events-none"/>
        {crop.w>2&&crop.h>2&&(
          <div className="absolute border-2 border-white pointer-events-none"
            style={{left:`${crop.x}%`,top:`${crop.y}%`,width:`${crop.w}%`,height:`${crop.h}%`,boxShadow:'0 0 0 9999px rgba(0,0,0,0.4)',background:'transparent'}}/>
        )}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold text-slate-500">취소</button>
        <button type="button" onClick={confirm} disabled={crop.w<5||crop.h<5}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sage py-3 text-sm font-semibold text-white disabled:opacity-50">
          <CropIcon size={15}/> 자르기 완료
        </button>
      </div>
    </div>
  );
}

function scaleNutrition(base, ratio) {
  return {
    calories: Math.round((base.calories||0)*ratio),
    carbs:    Math.round(((base.carbs||0)*ratio)*100)/100,
    protein:  Math.round(((base.protein||0)*ratio)*100)/100,
    fat:      Math.round(((base.fat||0)*ratio)*100)/100,
    sodium:   Math.round(((base.sodium||0)*ratio)*100)/100,
    sugar:    Math.round(((base.sugar||0)*ratio)*100)/100,
  };
}

export function MealDiaryPage() {
  const today = new Date();
  const calendarRef = useRef(null);
  const searchTimerRef = useRef(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [data, setData] = useState({ diaries:[], weeklyTotals:[] });
  const [recipes, setRecipes] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // 사진
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const [representativeIdx, setRepresentativeIdx] = useState(0);
  const [rawPhotoSrc, setRawPhotoSrc] = useState(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropTargetIdx, setCropTargetIdx] = useState(0);

  // 집밥/외식
  const [mealCat, setMealCat] = useState('home-cooked');
  const [diningOutList, setDiningOutList] = useState([]);
  const [selectedDiningOut, setSelectedDiningOut] = useState(null);
  const [loadingDining, setLoadingDining] = useState(false);

  // 메뉴 아이템
  const [mealItems, setMealItems] = useState([]);
  const [createRecipe, setCreateRecipe] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [newIngredients, setNewIngredients] = useState([{ name:'', grams:'', unitType:'g', unitAmount:'' }]);
  const [newSteps, setNewSteps] = useState(['']);
  const [newCookingTools, setNewCookingTools] = useState([]);

  // 메뉴 피커
  const [menuPickerModal, setMenuPickerModal] = useState(false);
  const [menuTab, setMenuTab] = useState('recipe');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuResults, setMenuResults] = useState([]);
  const [menuSearching, setMenuSearching] = useState(false);
  const [menuSelected, setMenuSelected] = useState(null);
  const [menuServings, setMenuServings] = useState('1');
  const [menuGrams, setMenuGrams] = useState('100');

  // 나의 한 달
  const [myMonthModal, setMyMonthModal] = useState(false);
  const [myMonthYear, setMyMonthYear] = useState(today.getFullYear());
  const [myMonthMonth, setMyMonthMonth] = useState(today.getMonth()+1);
  const [capturingImage, setCapturingImage] = useState(false);
  const [monthPickerModal, setMonthPickerModal] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { date:'', mealType:'아침', mealTime:nowTime(), diaryText:'', recipeId:'', recipeName:'', cookingTime:15, satisfaction:5, calories:0, carbs:0, protein:0, fat:0, sodium:0, sugar:0 }
  });

  // Object URL 정리
  useEffect(() => {
    const urls = photoFiles.map(f => URL.createObjectURL(f));
    setPhotoPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const monthKey = format(currentMonth, 'yyyy-MM');
  const load = async () => {
    const [diaryRes, recipesRes] = await Promise.all([
      api.get('/meal-diaries', { params:{ month:monthKey } }),
      api.get('/recipes')
    ]);
    setData(diaryRes.data); setRecipes(recipesRes.data);
  };
  useEffect(() => { load(); }, [monthKey]);

  const canGoNext = !isAfter(startOfMonth(addMonths(currentMonth,1)), startOfMonth(today));
  const goPrev = () => setCurrentMonth(p => subMonths(p,1));
  const goNext = () => { if(canGoNext) setCurrentMonth(p => addMonths(p,1)); };

  const calendarWeeks = useMemo(() => {
    const ms=startOfMonth(currentMonth), me=endOfMonth(currentMonth);
    const s=startOfWeek(ms,{weekStartsOn:0}), e=endOfWeek(me,{weekStartsOn:0});
    const all=eachDayOfInterval({start:s,end:e}).map(d => isSameMonth(d,currentMonth)?d:null);
    const weeks=[]; for(let i=0;i<all.length;i+=7) weeks.push(all.slice(i,i+7));
    return weeks;
  }, [currentMonth]);

  const diaryMap = useMemo(() => {
    const map = new Map();
    data.diaries.forEach(entry => {
      const items = Array.isArray(entry.mealItems) ? entry.mealItems : [];
      const totalCal = items.length>0 ? items.reduce((s,i)=>s+(i.calories||0),0) : (entry.recipe?.calories||0);
      map.set(`${format(new Date(entry.date),'yyyy-MM-dd')}-${entry.mealType}`, {...entry, mealItems:items, totalCalories:totalCal});
    });
    return map;
  }, [data]);

  const openSlot = (date, mealType) => {
    const key = `${format(date,'yyyy-MM-dd')}-${mealType}`;
    const existing = diaryMap.get(key);
    setSelectedSlot({ date, mealType, existing });
    setPhotoFiles([]); setPhotoPreviewUrls([]); setRepresentativeIdx(0);
    setRawPhotoSrc(null); setCropMode(false);
    setCreateRecipe(false);
    setMealItems(existing?.mealItems || []);
    setNewIngredients([{name:'',grams:'',unitType:'g',unitAmount:''}]); setNewSteps(['']); setNewCookingTools([]);
    setMealCat(existing?.mealCategory || 'home-cooked');
    setSelectedDiningOut(null);
    setLoadingDining(true);
    api.get('/purchases/dining-out').then(r => setDiningOutList(r.data)).catch(()=>{}).finally(()=>setLoadingDining(false));
    reset({
      date: format(date,'yyyy-MM-dd'), mealType,
      mealTime: existing ? (existing.mealTime||'') : nowTime(),
      diaryText: existing?.diaryText||'', recipeId: existing?.recipeId||'',
      recipeName:'', cookingTime:15, satisfaction:5, calories:0, carbs:0, protein:0, fat:0, sodium:0, sugar:0
    });
  };

  const handleMultiPhotoSelect = e => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    setPhotoFiles(prev => [...prev, ...files]);
    e.target.value='';
  };
  const handleCropTarget = idx => {
    if(!photoPreviewUrls[idx]) return;
    fetch(photoPreviewUrls[idx]).then(r=>r.blob()).then(blob=>{
      setRawPhotoSrc(URL.createObjectURL(blob)); setCropTargetIdx(idx); setCropMode(true);
    });
  };
  const handleCropDone = croppedFile => {
    setPhotoFiles(prev => prev.map((f,i) => i===cropTargetIdx ? croppedFile : f));
    setCropMode(false); setRawPhotoSrc(null);
  };
  const removePhoto = idx => {
    setPhotoFiles(prev => prev.filter((_,i)=>i!==idx));
    if(representativeIdx>=idx && representativeIdx>0) setRepresentativeIdx(r=>r-1);
    else if(representativeIdx===idx) setRepresentativeIdx(0);
  };

  const submit = async values => {
    setSavingEntry(true);
    try {
      const formData = new FormData();
      formData.append('date', values.date);
      formData.append('mealType', values.mealType);
      formData.append('mealTime', values.mealTime||'');
      formData.append('diaryText', values.diaryText);
      formData.append('mealCategory', mealCat);
      if(mealCat==='dining-out' && selectedDiningOut) {
        formData.append('diningOutId', String(selectedDiningOut.id));
        formData.append('mealItems', JSON.stringify([{ type:'dining-out', id:selectedDiningOut.id, name:selectedDiningOut.itemName, restaurant:selectedDiningOut.source, price:selectedDiningOut.price, calories:0 }]));
      } else {
        if(values.recipeId) formData.append('recipeId', values.recipeId);
        if(mealItems.length>0) formData.append('mealItems', JSON.stringify(mealItems));
      }
      if(photoFiles.length>0) formData.append('photo', photoFiles[representativeIdx]||photoFiles[0]);
      if(createRecipe) {
        formData.append('newRecipe', JSON.stringify({
          name:values.recipeName, cookingTime:Number(values.cookingTime), satisfaction:Number(values.satisfaction),
          calories:Number(values.calories), carbs:Number(values.carbs), protein:Number(values.protein),
          fat:Number(values.fat), sodium:Number(values.sodium), sugar:Number(values.sugar),
          cookingTools:newCookingTools.filter(t=>t.trim()),
          ingredients:newIngredients.filter(i=>i.name.trim()).map(i=>{
            const ut=i.unitType||'g';
            let g=Number(i.grams)||0;
            if(ut==='count') g=Math.round(g*(Number(i.unitAmount)||0)); // #4: 개수×개당g
            if(ut==='kg')    g=Math.round(g*1000);                       // #4: kg→g
            return {name:i.name.trim(),grams:g,unitType:ut,unitAmount:Number(i.unitAmount)||undefined};
          }),
          steps:newSteps.filter(s=>s.trim()), eatenDates:[values.date]
        }));
      }
      await api.post('/meal-diaries', formData, { headers:{'Content-Type':'multipart/form-data'} });
      setSelectedSlot(null); await load();
    } finally { setSavingEntry(false); }
  };

  // 메뉴 검색 (디바운스)
  const searchMenu = async keyword => {
    if(!keyword.trim()) {
      setMenuResults(menuTab==='recipe' ? recipes.map(r=>({...r,source:'saved'})) : []);
      if(menuTab==='food') api.get('/nutrition').then(res=>setMenuResults((res.data||[]).map(n=>({...n,source:'nutrition'})))).catch(()=>{});
      return;
    }
    setMenuSearching(true);
    try {
      if(menuTab==='recipe') {
        const saved = recipes.filter(r=>r.name.includes(keyword.trim())).map(r=>({...r,source:'saved'}));
        try { const pub=await api.get('/search-cooked-recipes',{params:{keyword:keyword.trim()}}); setMenuResults([...saved,...(pub.data||[]).map(r=>({...r,source:'public'}))]); }
        catch { setMenuResults(saved); }
      } else {
        const [savedRes,pubRes] = await Promise.allSettled([api.get('/nutrition',{params:{query:keyword.trim()}}),api.get('/search-food',{params:{keyword:keyword.trim()}})]);
        const saved = savedRes.status==='fulfilled'?(savedRes.value.data||[]):[];
        const pub = pubRes.status==='fulfilled'?(pubRes.value.data||[]):[];
        setMenuResults([...saved.map(n=>({...n,source:'nutrition'})),...pub.map(n=>({...n,source:'public-food'}))]);
      }
    } finally { setMenuSearching(false); }
  };
  const handleMenuSearchChange = e => {
    const val = e.target.value; setMenuSearch(val);
    if(searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(()=>searchMenu(val), 400);
  };
  const switchMenuTab = tab => {
    setMenuTab(tab); setMenuSearch(''); setMenuResults([]); setMenuSelected(null); setMenuServings('1'); setMenuGrams('100');
    if(tab==='recipe') setMenuResults(recipes.map(r=>({...r,source:'saved'})));
    if(tab==='food') api.get('/nutrition').then(res=>setMenuResults((res.data||[]).map(n=>({...n,source:'nutrition'})))).catch(()=>{});
  };
  const openMenuPicker = () => {
    setMenuPickerModal(true); setMenuTab('recipe'); setMenuSearch(''); setMenuSelected(null); setMenuServings('1'); setMenuGrams('100');
    setMenuResults(recipes.map(r=>({...r,source:'saved'})));
  };
  const previewNutrition = useMemo(() => {
    if(!menuSelected) return null;
    const ratio = menuTab==='recipe' ? Math.max(0,Number(menuServings)||1) : Math.max(0,(Number(menuGrams)||100))/100;
    return scaleNutrition(menuSelected, ratio);
  }, [menuSelected, menuServings, menuGrams, menuTab]);
  const confirmAddMenuItem = () => {
    if(!menuSelected||!previewNutrition) return;
    const item = { type:menuTab==='recipe'?'recipe':'nutrition', id:menuSelected.id||null, name:menuSelected.name, source:menuSelected.source, ...previewNutrition, _base:{calories:menuSelected.calories,carbs:menuSelected.carbs,protein:menuSelected.protein,fat:menuSelected.fat,sodium:menuSelected.sodium,sugar:menuSelected.sugar} };
    if(menuTab==='recipe') item.servings=Number(menuServings)||1; else item.grams=Number(menuGrams)||100;
    setMealItems(p=>[...p,item]);
    setMenuPickerModal(false); setMenuSelected(null); setMenuSearch(''); setMenuResults([]); setMenuServings('1'); setMenuGrams('100');
  };

  const saveMonthImage = async () => {
    setCapturingImage(true);
    try {
      let h2c = window.html2canvas;
      if(!h2c) {
        await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload=res; s.onerror=rej; document.body.appendChild(s); });
        h2c = window.html2canvas;
      }
      setCurrentMonth(new Date(myMonthYear,myMonthMonth-1,1)); setMyMonthModal(false);
      await new Promise(r=>setTimeout(r,700));
      const canvas = await h2c(calendarRef.current, { backgroundColor:'#ffffff', scale:2, useCORS:true, allowTaint:true, logging:false, windowWidth:1400 });
      const link = document.createElement('a');
      link.download = `식단일기_${myMonthYear}년_${String(myMonthMonth).padStart(2,'0')}월.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    } catch { alert('이미지 저장 중 오류가 발생했습니다.'); }
    finally { setCapturingImage(false); }
  };

  const totalNutrition = useMemo(() => mealItems.reduce((acc,i)=>({calories:acc.calories+(i.calories||0),carbs:acc.carbs+(i.carbs||0),protein:acc.protein+(i.protein||0),fat:acc.fat+(i.fat||0)}),{calories:0,carbs:0,protein:0,fat:0}),[mealItems]);

  return (
    <div>
      <PageHeader title="식단 일기" subtitle="날짜와 식사를 선택해 사진, 일기, 레시피를 함께 기록하세요."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>setMyMonthModal(true)} className="flex items-center gap-2 rounded-2xl bg-[#F4F8F1] px-4 py-3 text-sm font-semibold text-sage hover:bg-sage hover:text-white transition-colors"><Camera size={16}/> 나의 한 달</button>
            <button onClick={goPrev} className="rounded-2xl border border-border bg-white px-4 py-3 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16}/></button>
            <button onClick={()=>{ setPickerYear(currentMonth.getFullYear()); setMonthPickerModal(true); }} className="rounded-2xl bg-[#F4F8F1] px-4 py-3 font-semibold text-slate-900 hover:bg-[#EDF7E7]">
              {format(currentMonth,'yyyy년 M월',{locale:ko})}
            </button>
            <button onClick={goNext} disabled={!canGoNext} className={`rounded-2xl border border-border px-4 py-3 font-semibold ${canGoNext?'bg-white text-slate-500 hover:bg-slate-50':'bg-slate-50 text-slate-300 cursor-not-allowed'}`}><ChevronRight size={16}/></button>
          </div>
        }
      />

      {/* 모바일 전용 compact 달력 */}
      <div className="xl:hidden soft-card p-4 mb-4">
        <div className="grid grid-cols-7 mb-1">
          {['일','월','화','수','목','금','토'].map(d => <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>)}
        </div>
        {calendarWeeks.map((week,wi) => (
          <div key={wi} className="grid grid-cols-7 mb-0.5">
            {week.map((day,di) => {
              if(!day) return <div key={`e-${wi}-${di}`}/>;
              const dayStr = format(day,'yyyy-MM-dd');
              const mealCount = mealTypes.filter(mt=>diaryMap.has(`${dayStr}-${mt}`)).length;
              const isSelected = selectedSlot && format(selectedSlot.date,'yyyy-MM-dd')===dayStr;
              return (
                <button key={day.toISOString()} onClick={()=>{ if(isSelected) setSelectedSlot(null); else openSlot(day, mealTypes[0]); }}
                  className={`relative mx-0.5 flex flex-col items-center justify-center rounded-xl py-1.5 transition-all ${isToday(day)?'bg-sage text-white':isSelected?'bg-[#EDF7E7] text-sage ring-2 ring-sage':'text-slate-700 hover:bg-slate-50'}`}>
                  <span className="text-sm font-bold leading-none">{format(day,'d')}</span>
                  {mealCount>0&&<div className="flex gap-0.5 mt-0.5">{Array.from({length:Math.min(mealCount,4)}).map((_,i)=><div key={i} className={`w-1 h-1 rounded-full ${isToday(day)?'bg-white/80':'bg-sage/50'}`}/>)}</div>}
                </button>
              );
            })}
          </div>
        ))}
        {selectedSlot && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="text-sm font-bold text-slate-700 mb-3">{format(selectedSlot.date,'M월 d일 (eee)',{locale:ko})} 식단</div>
            <div className="space-y-2">
              {mealTypes.map(mt => {
                const entry = diaryMap.get(`${format(selectedSlot.date,'yyyy-MM-dd')}-${mt}`);
                return (
                  <button key={mt} onClick={()=>openSlot(selectedSlot.date,mt)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${entry?'border-sage/30 bg-[#F4F8F1]':'border-dashed border-border bg-[#F9FBF7]'}`}>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${getMealSlotTone(mt)}`}>{mt}</span>
                    {entry?.photoUrl&&<img src={entry.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" onError={e=>{e.currentTarget.style.display='none'}}/>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {entry?.mealItems?.length>0 ? entry.mealItems.map(i=>i.name).join(', ') : entry?.recipe?.name||(entry?entry.diaryText?.slice(0,20)||'기록됨':'기록 추가')}
                      </div>
                      {entry?.totalCalories>0&&<div className="text-xs text-sage font-semibold">{entry.totalCalories}kcal</div>}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0"/>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!selectedSlot&&<div className="mt-4 text-center text-sm text-slate-400 py-2">날짜를 선택하면 식단을 기록할 수 있어요</div>}
      </div>

      {/* 데스크톱 달력 */}
      <div className="hidden xl:grid gap-5 xl:grid-cols-[220px,1fr]">
        <aside className="soft-card p-5">
          <div className="text-lg font-bold text-slate-900">주차별 구매 금액</div>
          <div className="mt-4 space-y-3">
            {data.weeklyTotals?.map(week => (
              <div key={week.label} className="rounded-[22px] bg-[#F4F8F1] p-4">
                <div className="text-sm font-semibold text-slate-500">{week.label}</div>
                <div className="mt-2 text-xl font-extrabold text-slate-900">{formatCurrency(week.total)}</div>
                <div className="mt-1 text-xs text-slate-400">{week.range}</div>
              </div>
            ))}
          </div>
        </aside>
        <section ref={calendarRef} className="soft-card overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-border bg-[#FCFCFC] text-center text-sm font-semibold text-slate-500">
            {['일','월','화','수','목','금','토'].map(d=><div key={d} className="px-2 py-4">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarWeeks.flatMap((week,wi)=>week.map((day,di)=>{
              if(!day) return <div key={`e-${wi}-${di}`} className="min-h-[180px] border-b border-r border-border bg-[#F8F8F8]"/>;
              return (
                <div key={day.toISOString()} className="min-h-[180px] border-b border-r border-border bg-white p-3">
                  <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday(day)?'bg-sage text-white':'text-slate-700'}`}>{format(day,'d')}</div>
                  <div className="space-y-2">
                    {mealTypes.map(mealType => {
                      const entry = diaryMap.get(`${format(day,'yyyy-MM-dd')}-${mealType}`);
                      return (
                        <button key={mealType} onClick={()=>openSlot(day,mealType)}
                          className={`block w-full rounded-2xl border px-3 py-2 text-left text-xs transition ${entry?'border-transparent bg-white shadow-sm':'border-dashed border-border bg-[#F9FBF7]'}`}>
                          <div className={`inline-flex rounded-full px-2 py-1 font-semibold ${getMealSlotTone(mealType)}`}>{mealType}</div>
                          {entry?.mealTime&&<span className="ml-1 text-[10px] text-slate-400">{entry.mealTime}</span>}
                          {entry?.mealCategory==='dining-out'&&<span className="ml-1 text-[10px] text-orange-400">🍽️외식</span>}
                          {entry?.photoUrl&&<div className="mt-1.5 overflow-hidden rounded-xl"><img src={entry.photoUrl} alt={mealType} className="h-14 w-full object-cover" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/></div>}
                          {entry?.mealItems?.length>0 ? (
                            <div className="mt-1 space-y-0.5"><div className="truncate text-slate-600 text-[10px]">{entry.mealItems.map(i=>i.name).join(', ')}</div><div className="text-[10px] font-semibold text-sage">{entry.totalCalories}kcal</div></div>
                          ) : (
                            <div className="mt-1 truncate text-slate-600">{entry?.recipe?.name||(entry?entry.diaryText?.slice(0,12)||'기록됨':'기록 추가')}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }))}
          </div>
        </section>
      </div>

      {/* 식단 입력 모달 */}
      <Modal open={!!selectedSlot&&!cropMode} onClose={()=>setSelectedSlot(null)}
        title={selectedSlot?`${format(selectedSlot.date,'M월 d일 (eee)',{locale:ko})} · ${selectedSlot.mealType}`:''}
        className="max-w-3xl">
        <form onSubmit={handleSubmit(submit)} className="grid gap-4">

          {/* 집밥 / 외식 토글 */}
          <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
            <button type="button" onClick={()=>{setMealCat('home-cooked');setSelectedDiningOut(null);}}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${mealCat==='home-cooked'?'bg-white text-sage shadow-sm':'text-slate-500'}`}>
              <Utensils size={15}/> 집밥
            </button>
            <button type="button" onClick={()=>setMealCat('dining-out')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${mealCat==='dining-out'?'bg-white text-orange-500 shadow-sm':'text-slate-500'}`}>
              <UtensilsCrossed size={15}/> 외식
            </button>
          </div>

          {/* 외식 선택 UI */}
          {mealCat==='dining-out' && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
              <div className="text-sm font-bold text-orange-700">외식 기록에서 선택</div>
              {loadingDining ? (
                <div className="text-sm text-slate-400">외식 목록 불러오는 중...</div>
              ) : diningOutList.length===0 ? (
                <div className="text-sm text-slate-400">저장된 외식 기록이 없습니다. 구매내역 탭 → 외식 기록에서 먼저 추가하세요.</div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {diningOutList.map(item => (
                    <button key={item.id} type="button" onClick={()=>setSelectedDiningOut(item)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${selectedDiningOut?.id===item.id?'border-orange-400 bg-orange-100':'border-border bg-white hover:border-orange-200'}`}>
                      <span className="text-lg">🍽️</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{item.itemName}</div>
                        <div className="text-xs text-slate-400">{item.source} · {new Date(item.date).toLocaleDateString('ko-KR')}{item.price>0?` · ${item.price.toLocaleString()}원`:''}</div>
                      </div>
                      {selectedDiningOut?.id===item.id&&<span className="text-orange-500 font-bold text-xs shrink-0">✓ 선택</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedDiningOut&&<div className="rounded-xl bg-orange-100 border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800">✅ {selectedDiningOut.itemName} 선택됨</div>}
            </div>
          )}

          {/* 집밥 폼 (외식 선택 시 반투명) */}
          <div className={mealCat==='dining-out'?'opacity-40 pointer-events-none space-y-4':'space-y-4'}>
            <div className="grid gap-4 md:grid-cols-2">
              {/* 사진 */}
              <div className="space-y-3">
                <div className="rounded-[24px] border-2 border-dashed border-border bg-[#FCFCFC] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-500">사진 추가</div>
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#EDF7E7] px-3 py-1.5 text-xs font-semibold text-sage hover:bg-sage hover:text-white transition-colors">
                      <Camera size={12}/> 사진 추가
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleMultiPhotoSelect}/>
                    </label>
                  </div>
                  {photoFiles.length===0&&selectedSlot?.existing?.photoUrl&&(
                    <img src={selectedSlot.existing.photoUrl} alt="기존" className="w-full h-28 object-cover rounded-xl" onError={e=>{e.currentTarget.style.display='none'}}/>
                  )}
                  {photoFiles.length>0&&(
                    <div className="grid grid-cols-3 gap-2">
                      {photoPreviewUrls.map((url,i)=>(
                        <div key={i} className={`relative rounded-xl overflow-hidden border-2 ${i===representativeIdx?'border-sage':'border-transparent'}`}>
                          <img src={url} alt={`사진${i+1}`} className="w-full h-20 object-cover"/>
                          <button type="button" onClick={()=>setRepresentativeIdx(i)} className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${i===representativeIdx?'bg-sage text-white':'bg-black/40 text-white'}`}>{i===representativeIdx?'★대표':'대표'}</button>
                          <button type="button" onClick={()=>handleCropTarget(i)} className="absolute top-1 right-6 rounded-full bg-black/40 p-0.5 text-white"><CropIcon size={10}/></button>
                          <button type="button" onClick={()=>removePhoto(i)} className="absolute top-1 right-1 rounded-full bg-black/40 p-0.5 text-white"><X size={10}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {photoFiles.length===0&&!selectedSlot?.existing?.photoUrl&&<div className="text-center text-xs text-slate-400 py-3">여러 장 추가 후 대표 이미지 선택</div>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">식사 시간</label>
                  <input type="time" {...register('mealTime')} className="input-base"/>
                </div>
              </div>
              <textarea {...register('diaryText')} className="input-base min-h-[140px]" placeholder="오늘 식사 일기를 입력하세요"/>
            </div>

            {/* 이번 끼니 메뉴 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-700">이번 끼니 메뉴</div>
                <button type="button" onClick={openMenuPicker} className="flex items-center gap-1.5 rounded-xl bg-[#EDF7E7] px-3 py-1.5 text-xs font-semibold text-sage hover:bg-sage hover:text-white transition-colors"><Plus size={14}/> 메뉴 추가</button>
              </div>
              {mealItems.length>0&&(
                <div className="space-y-2">
                  {mealItems.map((item,i)=>(
                    <div key={i} className="flex items-center justify-between rounded-xl bg-[#F4F8F1] px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-xs text-sage mt-0.5">{item.calories}kcal{item.servings?` · ${item.servings}인분`:item.grams?` · ${item.grams}g`:''}</div>
                      </div>
                      <button type="button" onClick={()=>setMealItems(p=>p.filter((_,idx)=>idx!==i))} className="ml-3 flex-shrink-0 text-coral hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  ))}
                  <div className="rounded-xl bg-sage/10 border border-sage/20 px-3 py-2 text-xs">
                    <span className="font-bold text-sage">끼니 총합</span>
                    <span className="ml-2 text-slate-600">{totalNutrition.calories}kcal · 탄수 {totalNutrition.carbs.toFixed(1)}g · 단백질 {totalNutrition.protein.toFixed(1)}g · 지방 {totalNutrition.fat.toFixed(1)}g</span>
                  </div>
                </div>
              )}
            </div>

            {/* 레시피 선택 */}
            <div className="grid gap-4 md:grid-cols-2">
              <select {...register('recipeId')} className="input-base" disabled={createRecipe}>
                <option value="">단일 레시피 선택</option>
                {recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button type="button" onClick={()=>setCreateRecipe(p=>!p)} className={`rounded-2xl px-4 py-3 font-semibold transition-colors ${createRecipe?'bg-sage text-white':'bg-[#F4F8F1] text-sage hover:bg-sage hover:text-white'}`}>+ 새 레시피 직접 입력</button>
            </div>

            {createRecipe&&(
              <div className="grid gap-4 rounded-[28px] bg-[#FCFCFC] p-5">
                <div><label className="mb-1 block text-xs font-bold text-slate-500">레시피 이름</label><input {...register('recipeName')} className="input-base" placeholder="새 레시피 이름"/></div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">조리시간(분)</label><input {...register('cookingTime')} className="input-base" type="number"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">만족도(1~5)</label><input {...register('satisfaction')} className="input-base" type="number" min="1" max="5"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">칼로리(kcal)</label><input {...register('calories')} className="input-base" type="number" step="0.01"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">탄수(g)</label><input {...register('carbs')} className="input-base" type="number" step="0.01"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">단백질(g)</label><input {...register('protein')} className="input-base" type="number" step="0.01"/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">지방(g)</label><input {...register('fat')} className="input-base" type="number" step="0.01"/></div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold text-slate-500">사용 재료</label><button type="button" onClick={()=>setNewIngredients(p=>[...p,{name:'',grams:''}])} className="rounded-lg bg-[#EDF7E7] px-2.5 py-1 text-xs font-semibold text-sage">+ 재료</button></div>
                  {newIngredients.map((ing,i)=>(
                    <div key={i} className="mb-2 space-y-1.5">
                      <div className="flex gap-2 items-center">
                        {/* 재료명 */}
                        <input className="input-base flex-1 text-sm" placeholder="재료명" value={ing.name}
                          onChange={e=>setNewIngredients(p=>p.map((x,idx)=>idx===i?{...x,name:e.target.value}:x))}/>
                        {/* #4 Fix: 단위 선택 */}
                        <select className="input-base w-20 text-xs px-1" value={ing.unitType||'g'}
                          onChange={e=>setNewIngredients(p=>p.map((x,idx)=>idx===i?{...x,unitType:e.target.value,grams:'',unitAmount:''}:x))}>
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="kg">kg</option>
                          <option value="count">개</option>
                        </select>
                        {newIngredients.length>1&&<button type="button" onClick={()=>setNewIngredients(p=>p.filter((_,idx)=>idx!==i))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral"><X size={13}/></button>}
                      </div>
                      {/* #4 Fix: count 모드 — 개수 + 개당 용량 */}
                      {ing.unitType==='count' ? (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input className="input-base text-sm" type="number" min="0.01" step="1"
                              placeholder="개수" value={ing.grams}
                              onChange={e=>setNewIngredients(p=>p.map((x,idx)=>idx===i?{...x,grams:e.target.value}:x))}/>
                          </div>
                          <div className="flex-1">
                            <input className="input-base text-sm" type="number" min="0.01" step="0.1"
                              placeholder="개당(g)" value={ing.unitAmount}
                              onChange={e=>setNewIngredients(p=>p.map((x,idx)=>idx===i?{...x,unitAmount:e.target.value}:x))}/>
                          </div>
                          {ing.grams&&ing.unitAmount&&<span className="text-xs text-sage self-center whitespace-nowrap">
                            ={Math.round(Number(ing.grams)*Number(ing.unitAmount))}g
                          </span>}
                        </div>
                      ) : (
                        <input className="input-base text-sm" type="number" min="0.01" step="0.01"
                          placeholder={ing.unitType==='ml'?'ml':ing.unitType==='kg'?'kg':'g'}
                          value={ing.grams}
                          onChange={e=>setNewIngredients(p=>p.map((x,idx)=>idx===i?{...x,grams:e.target.value}:x))}/>
                      )}
                    </div>
                  ))}
                </div>
                {/* 영양정보 자동 계산 */}
                <NutritionAutoCalc
                  ingredients={newIngredients}
                  onResult={nut => {
                    setValue('calories', nut.calories); setValue('carbs', nut.carbs); setValue('protein', nut.protein);
                    setValue('fat', nut.fat); setValue('sodium', nut.sodium); setValue('sugar', nut.sugar);
                  }}
                />
              </div>
            )}
          </div>

          <button disabled={savingEntry} className="w-full rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">
            {savingEntry?'저장 중...':'저장하기'}
          </button>
        </form>
      </Modal>

      {/* 메뉴 피커 */}
      <Modal open={menuPickerModal} onClose={()=>setMenuPickerModal(false)} title="메뉴 추가" className="max-w-xl">
        <div className="space-y-4">
          <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
            <button type="button" onClick={()=>switchMenuTab('recipe')} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${menuTab==='recipe'?'bg-white text-sage shadow-sm':'text-slate-500'}`}>🍳 레시피</button>
            <button type="button" onClick={()=>switchMenuTab('food')} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${menuTab==='food'?'bg-white text-sage shadow-sm':'text-slate-500'}`}>🏪 기성식품</button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input className="input-base pl-10" placeholder={menuTab==='recipe'?'레시피 검색 (저장 + 공공 조리식품)':'기성식품 검색'} value={menuSearch} onChange={handleMenuSearchChange}/>
            {menuSearching&&<Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"/>}
          </div>
          {!menuSelected&&(
            <div className="max-h-52 overflow-y-auto space-y-1 rounded-2xl border border-border bg-white p-1">
              {menuResults.length===0?(<div className="py-6 text-center text-sm text-slate-400">검색어를 입력하거나 목록을 선택하세요.</div>)
              :menuResults.map((item,i)=>(
                <button key={`${item.name}-${i}`} type="button" onClick={()=>setMenuSelected(item)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm hover:bg-[#F4F8F1] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.calories||0}kcal {item.source==='public'?'공공DB':item.source==='saved'?'저장됨':item.source==='nutrition'?'저장됨':item.source==='public-food'?'공공식품DB':''}</div>
                  </div>
                  <ChefHat size={16} className="text-slate-300 flex-shrink-0"/>
                </button>
              ))}
            </div>
          )}
          {menuSelected&&(
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[#F4F8F1] px-4 py-3">
                <div><div className="font-bold text-slate-900">{menuSelected.name}</div><div className="text-xs text-slate-500 mt-0.5">{menuSelected.calories||0}kcal / 1{menuTab==='recipe'?'인분':'00g'}</div></div>
                <button type="button" onClick={()=>setMenuSelected(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
              </div>
              {menuTab==='recipe'?(
                <div><label className="mb-1.5 block text-sm font-bold text-slate-700">인분 입력</label>
                  <div className="flex items-center gap-3"><input type="number" min="0.1" step="0.1" className="input-base flex-1" value={menuServings} onChange={e=>setMenuServings(e.target.value)}/><span className="font-semibold text-slate-500">인분</span></div>
                  <p className="mt-1 text-xs text-slate-400">1.5인분 → 모든 영양성분 × 1.5 자동 계산</p></div>
              ):(
                <div><label className="mb-1.5 block text-sm font-bold text-slate-700">섭취량 입력</label>
                  <div className="flex items-center gap-3"><input type="number" min="1" step="1" className="input-base flex-1" value={menuGrams} onChange={e=>setMenuGrams(e.target.value)}/><span className="font-semibold text-slate-500">g</span></div></div>
              )}
              {previewNutrition&&(
                <div className="rounded-2xl bg-white border border-border p-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2 flex justify-between items-baseline"><span className="text-xs text-slate-400">예상 칼로리</span><span className="text-xl font-extrabold text-sage">{previewNutrition.calories}kcal</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-xs">탄수화물</span><span className="font-semibold">{previewNutrition.carbs}g</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-xs">단백질</span><span className="font-semibold">{previewNutrition.protein}g</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-xs">지방</span><span className="font-semibold">{previewNutrition.fat}g</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-xs">나트륨</span><span className="font-semibold">{previewNutrition.sodium}mg</span></div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={()=>setMenuSelected(null)} className="flex-1 rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-slate-500">다시 선택</button>
                <button type="button" onClick={confirmAddMenuItem} className="flex-1 rounded-2xl bg-sage px-5 py-3 text-sm font-semibold text-white">메뉴에 추가</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 사진 자르기 */}
      <Modal open={cropMode} onClose={()=>{setCropMode(false);setRawPhotoSrc(null);}} title="사진 자르기" className="max-w-lg">
        {rawPhotoSrc&&(<div><ImageCropper src={rawPhotoSrc} onCrop={handleCropDone} onCancel={()=>{setCropMode(false);setRawPhotoSrc(null);}}/><div className="mt-3 text-center"><button type="button" onClick={()=>{setCropMode(false);setRawPhotoSrc(null);}} className="text-xs text-slate-400 underline">자르지 않고 원본 사용</button></div></div>)}
      </Modal>

      {/* 년월 선택 */}
      <Modal open={monthPickerModal} onClose={()=>setMonthPickerModal(false)} title="년도 · 월 선택" className="max-w-sm">
        <div className="space-y-4">
          <div><label className="mb-2 block text-sm font-bold text-slate-700">년도</label>
            <div className="flex gap-2">{[today.getFullYear()-1,today.getFullYear()].map(y=>(<button key={y} type="button" onClick={()=>setPickerYear(y)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${pickerYear===y?'bg-sage text-white':'bg-slate-100 text-slate-700'}`}>{y}년</button>))}</div></div>
          <div><label className="mb-2 block text-sm font-bold text-slate-700">월</label>
            <div className="grid grid-cols-4 gap-2">{Array.from({length:12},(_,i)=>i+1).map(m=>{ const disabled=pickerYear===today.getFullYear()&&m>today.getMonth()+1; return (<button key={m} type="button" disabled={disabled} onClick={()=>{setCurrentMonth(new Date(pickerYear,m-1,1));setMonthPickerModal(false);}} className={`rounded-xl py-2.5 text-sm font-semibold ${disabled?'bg-slate-50 text-slate-300 cursor-not-allowed':currentMonth.getFullYear()===pickerYear&&currentMonth.getMonth()+1===m?'bg-sage text-white':'bg-slate-100 text-slate-700 hover:bg-[#EDF7E7]'}`}>{m}월</button>); })}</div></div>
        </div>
      </Modal>

      {/* 나의 한 달 */}
      <Modal open={myMonthModal} onClose={()=>setMyMonthModal(false)} title="나의 한 달 저장" className="max-w-sm">
        <div className="space-y-5">
          <p className="text-sm text-slate-500">원하는 년도와 월의 식단일기 화면을 이미지로 저장합니다.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">년도</label><select className="input-base" value={myMonthYear} onChange={e=>setMyMonthYear(Number(e.target.value))}>{[today.getFullYear()-1,today.getFullYear()].map(y=><option key={y} value={y}>{y}년</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">월</label><select className="input-base" value={myMonthMonth} onChange={e=>setMyMonthMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).filter(m=>myMonthYear<today.getFullYear()||m<=today.getMonth()+1).map(m=><option key={m} value={m}>{m}월</option>)}</select></div>
          </div>
          <button onClick={saveMonthImage} disabled={capturingImage} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">
            <Download size={16}/> {capturingImage?'저장 중...':'이미지로 저장'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
