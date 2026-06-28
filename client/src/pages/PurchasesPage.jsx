import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckSquare, Edit2, FileText, List, Loader2, Plus, Search, Square, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrency, formatDate } from '../lib/utils';

// 단위별 표기 헬퍼
function formatUnitDisplay(grams, unitType) {
  if (!grams && grams !== 0) return '-';
  if (unitType === 'ml')  return `${grams}ml`;
  if (unitType === 'kg')  return `${(grams / 1000).toFixed(2).replace(/\.00$/, '')}kg`;
  if (unitType === 'count') return `${grams}g`;
  return `${grams}g`;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res; s.onerror = rej; document.body.appendChild(s);
  });
  return window.Tesseract;
}

const FOOD_KEYWORDS = ['양파','마늘','대파','쪽파','당근','감자','고구마','고추','청양고추','오이','호박','애호박','가지','피망','파프리카','브로콜리','양배추','배추','상추','깻잎','시금치','부추','무','연근','버섯','표고버섯','느타리버섯','팽이버섯','새송이버섯','토마토','방울토마토','셀러리','사과','배','감','귤','오렌지','레몬','딸기','포도','복숭아','수박','참외','바나나','키위','망고','닭가슴살','닭고기','닭다리','삼겹살','목살','소고기','돼지고기','갈비','등심','안심','불고기','제육','베이컨','햄','소시지','참치','고등어','갈치','오징어','새우','조기','연어','멸치','달걀','계란','우유','치즈','버터','요거트','두부','연두부','순두부','쌀','현미','밀가루','빵','면','라면','파스타','국수','김','미역','다시마','간장','된장','고추장','참기름','들기름'];

function extractPrice(line) {
  const patterns = [/(\d{1,3}(?:,\d{3})+)\s*원?/, /(\d{4,7})\s*원/, /₩\s*(\d{1,3}(?:,\d{3})*)/, /(\d{3,6})$/];
  for (const p of patterns) { const m = line.match(p); if (m) { const n = Number(m[1].replace(/,/g,'')); if (n>=100&&n<=500000) return n; } }
  return 0;
}
function extractGrams(line) {
  const m = line.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|mL|L|그램)/i);
  if (!m) return 200;
  const v = Number(m[1]), u = m[2].toLowerCase();
  return u==='kg' ? Math.round(v*1000) : u==='l' ? Math.round(v*1000) : Math.round(v);
}
function parseReceiptOcr(text) {
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>=2);
  const results=[]; const seen=new Set();
  lines.forEach(line => {
    const matched = FOOD_KEYWORDS.find(k=>line.includes(k));
    if (matched&&!seen.has(matched)) { seen.add(matched); results.push({name:matched, price:extractPrice(line), grams:extractGrams(line), unit:'g'}); return; }
    const korWord = line.match(/([가-힣]{2,8})/g); const price = extractPrice(line);
    if (korWord&&price>0) { const name=korWord[0]; if(!seen.has(name)&&name.length>=2) { seen.add(name); results.push({name, price, grams:extractGrams(line), unit:'g'}); } }
  });
  return results;
}
function parseListOcr(text) {
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>=2);
  const results=[]; const seen=new Set();
  lines.forEach(line => {
    const gm=line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|그램|ml|mL|kg|L)\s*$/i);
    const cm=line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(개|봉|팩|묶음|병|캔)\s*$/i);
    if (gm) { const name=gm[1].trim(); if(!seen.has(name)&&name.length>=2){seen.add(name);results.push({name,price:0,grams:Number(gm[2]),unit:'g'});} return; }
    if (cm) { const name=cm[1].trim(); if(!seen.has(name)&&name.length>=2){seen.add(name);results.push({name,price:0,grams:Number(cm[2])*100,unit:'개',quantity:cm[2]});} return; }
    const matched=FOOD_KEYWORDS.find(k=>line.includes(k));
    if (matched&&!seen.has(matched)){seen.add(matched);results.push({name:matched,price:0,grams:200,unit:'g'});return;}
    const n=line.match(/^([가-힣\s]{2,12})$/);
    if(n){const name=n[1].trim();if(!seen.has(name)&&name.length>=2){seen.add(name);results.push({name,price:0,grams:200,unit:'g'});}}
  });
  return results;
}

const today = () => new Date().toISOString().slice(0,10);
const emptyPurchase = { itemName:'', price:'', grams:'', source:'', date:today(), purpose:'' };
const emptyDining = { itemName:'', source:'', price:'', date:today(), purpose:'' };

export function PurchasesPage() {
  // ── 메인 탭: 식재료 | 외식 ──
  const [mainTab, setMainTab] = useState('ingredient'); // 'ingredient' | 'dining'

  // ── 식재료 상태 ──
  const [purchases, setPurchases] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState(null);
  const [uploadTypeModal, setUploadTypeModal] = useState(false);
  const [ocrMode, setOcrMode] = useState('receipt');
  const [manualItems, setManualItems] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [isSubscription, setIsSubscription] = useState(false);
  const [subTotal, setSubTotal] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const [savingItems, setSavingItems] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchaseSource, setPurchaseSource] = useState('');
  const [purchasePurpose, setPurchasePurpose] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [fileInputEl, setFileInputEl] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyPurchase);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── 외식 상태 ──
  const [diningRecords, setDiningRecords] = useState([]);
  const [diningForm, setDiningForm] = useState(emptyDining);
  const [savingDining, setSavingDining] = useState(false);
  const [diningSuccess, setDiningSuccess] = useState('');
  const [diningFilterFrom, setDiningFilterFrom] = useState('');
  const [diningFilterTo, setDiningFilterTo] = useState('');
  const [showDiningHistory, setShowDiningHistory] = useState(false);
  const [editDiningModal, setEditDiningModal] = useState(false);
  const [editDiningForm, setEditDiningForm] = useState(emptyDining);
  const [deletingDiningId, setDeletingDiningId] = useState(null);

  // ── 영양정보 검색 ──
  const [nutrition, setNutrition] = useState([]);
  const [search, setSearch] = useState('');
  const [apiResults, setApiResults] = useState([]);
  const [apiMsg, setApiMsg] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [savingFood, setSavingFood] = useState('');
  const [askAddPurchase, setAskAddPurchase] = useState(null);

  const loadPurchases = async (from='', to='') => {
    const params = { category: 'ingredient' };
    if (from) params.from = from; if (to) params.to = to;
    const r = await api.get('/purchases', { params });
    setPurchases(r.data); setSelectedIds(new Set());
  };
  const loadDining = async (from='', to='') => {
    const params = {};
    if (from) params.from = from; if (to) params.to = to;
    const r = await api.get('/purchases/dining-out', { params });
    setDiningRecords(r.data);
  };
  const loadNutrition = async (q='') => { const r = await api.get('/nutrition', { params: q?{query:q}:{} }); setNutrition(r.data); };
  useEffect(() => { loadNutrition(); }, []);

  // ── OCR ──
  const handleUploadTypeSelect = (type, mode) => {
    setUploadTypeModal(false); setOcrMode(mode);
    if (type==='photo') fileInputEl?.click();
    else { setManualItems([{name:'',price:'',quantity:'',unit:'g'}]); setShowManual(true); setActiveMode('manual'); setIsSubscription(false); setSubTotal(''); setOcrItems(null); }
  };
  const handleOcr = async (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    setOcrLoading(true); setOcrItems(null); setActiveMode('ocr'); setIsSubscription(false); setSubTotal('');
    try {
      const T=await loadTesseract(); const w=await T.createWorker('kor+eng');
      const {data:{text}}=await w.recognize(file); await w.terminate();
      const parsed=ocrMode==='list'?parseListOcr(text):parseReceiptOcr(text);
      if(!parsed.length){alert('식재료를 인식하지 못했습니다.');setActiveMode(null);return;}
      setOcrItems(parsed);
    } catch {alert('사진 분석 중 오류가 발생했습니다.');setActiveMode(null);}
    finally {setOcrLoading(false);e.target.value='';}
  };
  const updateOcr=(i,f,v)=>setOcrItems(p=>p.map((it,idx)=>idx===i?{...it,[f]:v}:it));
  const removeOcr=(i)=>setOcrItems(p=>p.filter((_,idx)=>idx!==i));
  const updateManual=(i,f,v)=>setManualItems(p=>p.map((it,idx)=>idx===i?{...it,[f]:v}:it));
  const removeManual=(i)=>setManualItems(p=>p.filter((_,idx)=>idx!==i));
  const toGrams=(item)=>item.unit==='개'?Math.max(1,Number(item.quantity)||1)*100:Number(item.grams||item.quantity)||200;
  const computedItems = useMemo(()=>{
    const src=activeMode==='ocr'?ocrItems:manualItems;
    if(!src?.length)return[];
    if(isSubscription&&subTotal){const each=Math.round(Number(subTotal)/src.length);return src.map(it=>({...it,price:each}));}
    return src;
  },[ocrItems,manualItems,isSubscription,subTotal,activeMode]);

  const saveItems = async () => {
    const items=computedItems.filter(i=>i.name?.trim()); if(!items.length)return;
    setSavingItems(true);
    try {
      await api.post('/purchases/bulk',{items:items.map(item=>({itemName:item.name.trim(),price:Number(item.price)||0,grams:toGrams(item),source:purchaseSource.trim()||(activeMode==='ocr'?`사진OCR(${ocrMode==='list'?'리스트':'영수증'})`:'직접입력'),date:purchaseDate,purpose:purchasePurpose.trim()||undefined,category:'ingredient'}))});
      setSuccessMsg(`${items.length}개 등록 완료!`); setTimeout(()=>setSuccessMsg(''),3000);
      setOcrItems(null);setManualItems([]);setShowManual(false);setActiveMode(null);setIsSubscription(false);setSubTotal('');setPurchaseSource('');setPurchasePurpose('');
      if(showHistory)loadPurchases(filterFrom,filterTo);
    } finally {setSavingItems(false);}
  };
  const cancelEdit=()=>{setOcrItems(null);setManualItems([]);setShowManual(false);setActiveMode(null);setIsSubscription(false);setSubTotal('');};
  const openEdit=(p)=>{setEditForm({itemName:p.itemName,price:String(p.price),grams:String(p.grams),source:p.source,date:new Date(p.date).toISOString().slice(0,10),purpose:p.purpose||'',_id:p.id});setEditModal(true);};
  const submitEdit=async()=>{await api.put(`/purchases/${editForm._id}`,{itemName:editForm.itemName,price:Number(editForm.price),grams:Number(editForm.grams),source:editForm.source,date:editForm.date,purpose:editForm.purpose||undefined,category:'ingredient'});setEditModal(false);loadPurchases(filterFrom,filterTo);};
  const deletePurchase=async(id)=>{if(!confirm('삭제하면 연결된 식재료도 삭제됩니다.'))return;setDeletingId(id);try{await api.delete(`/purchases/${id}`);loadPurchases(filterFrom,filterTo);}finally{setDeletingId(null);}};
  const toggleSelect=(id)=>setSelectedIds(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
  const toggleSelectAll=()=>{if(selectedIds.size===purchases.length)setSelectedIds(new Set());else setSelectedIds(new Set(purchases.map(p=>p.id)));};
  const bulkDelete=async()=>{if(!selectedIds.size||!confirm(`${selectedIds.size}개 삭제?`))return;setBulkDeleting(true);try{await api.delete('/purchases/bulk',{data:{ids:Array.from(selectedIds)}});loadPurchases(filterFrom,filterTo);}finally{setBulkDeleting(false);}};
  const handlePeriodSearch=()=>{if(!filterFrom&&!filterTo)return;setShowHistory(true);loadPurchases(filterFrom,filterTo);};

  // ── 외식 저장 ──
  const saveDining = async () => {
    if(!diningForm.itemName.trim()){alert('음식/메뉴 이름을 입력해주세요.');return;}
    setSavingDining(true);
    try {
      await api.post('/purchases/bulk',{items:[{itemName:diningForm.itemName.trim(),price:Number(diningForm.price)||0,grams:0,source:diningForm.source.trim()||'외식',date:diningForm.date,purpose:diningForm.purpose.trim()||undefined,category:'dining-out'}]});
      setDiningSuccess('외식 기록이 저장되었습니다!');setTimeout(()=>setDiningSuccess(''),3000);
      setDiningForm(emptyDining);
      if(showDiningHistory)loadDining(diningFilterFrom,diningFilterTo);
    } finally {setSavingDining(false);}
  };
  const openEditDining=(p)=>{setEditDiningForm({itemName:p.itemName,source:p.source,price:String(p.price),date:new Date(p.date).toISOString().slice(0,10),purpose:p.purpose||'',_id:p.id});setEditDiningModal(true);};
  const submitEditDining=async()=>{await api.put(`/purchases/${editDiningForm._id}`,{itemName:editDiningForm.itemName,price:Number(editDiningForm.price),grams:0,source:editDiningForm.source,date:editDiningForm.date,purpose:editDiningForm.purpose||undefined,category:'dining-out'});setEditDiningModal(false);loadDining(diningFilterFrom,diningFilterTo);};
  const deleteDining=async(id)=>{if(!confirm('외식 기록을 삭제할까요?'))return;setDeletingDiningId(id);try{await api.delete(`/purchases/${id}`);}finally{setDeletingDiningId(null);loadDining(diningFilterFrom,diningFilterTo);}};
  const handleDiningSearch=()=>{if(!diningFilterFrom&&!diningFilterTo)return;setShowDiningHistory(true);loadDining(diningFilterFrom,diningFilterTo);};

  // ── 영양정보 검색 ──
  const handleSearch=async()=>{const kw=search.trim();setApiMsg('');setApiResults([]);if(!kw){await loadNutrition();setApiMsg('검색어를 입력해 주세요.');return;}setApiLoading(true);try{const[saved,pub]=await Promise.allSettled([api.get('/nutrition',{params:{query:kw}}),api.get('/search-food',{params:{keyword:kw}})]);if(saved.status==='fulfilled')setNutrition(saved.value.data);if(pub.status==='fulfilled'){setApiResults(pub.value.data);setApiMsg(pub.value.data.length>0?'클릭하면 영양정보에 저장됩니다.':'결과 없음');};}finally{setApiLoading(false);}};
  const selectNutrition=async(food)=>{if(!food.name)return;setSavingFood(food.name);try{await api.post('/nutrition',{name:food.name,calories:Number(food.calories)||0,carbs:Number(food.carbs)||0,protein:Number(food.protein)||0,fat:Number(food.fat)||0,sodium:Number(food.sodium)||0,sugar:Number(food.sugar)||0});await loadNutrition(food.name);setSearch(food.name);setApiResults([]);setApiMsg(`${food.name} 저장 완료`);setAskAddPurchase({name:food.name});}catch(err){setApiMsg(err.response?.data?.message||'저장 실패');}finally{setSavingFood('');}};
  const addNutritionToPurchases=()=>{setManualItems([{name:askAddPurchase.name,price:'',quantity:'',unit:'g'}]);setShowManual(true);setActiveMode('manual');setIsSubscription(false);setSubTotal('');setOcrItems(null);setAskAddPurchase(null);setMainTab('ingredient');};

  const totalSpent=useMemo(()=>purchases.reduce((s,p)=>s+p.price,0),[purchases]);
  const activeItems=activeMode==='ocr'?ocrItems:(showManual?manualItems:null);
  const allSelected=purchases.length>0&&selectedIds.size===purchases.length;

  return (
    <div>
      <PageHeader title="구매내역" subtitle="식재료 구매와 외식 기록을 함께 관리하세요."/>

      {/* ── 메인 탭 ── */}
      <div className="mb-6 flex rounded-2xl bg-slate-100 p-1 gap-1">
        <button onClick={()=>setMainTab('ingredient')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${mainTab==='ingredient'?'bg-white text-sage shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
          🛒 식재료 등록
        </button>
        <button onClick={()=>setMainTab('dining')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${mainTab==='dining'?'bg-white text-orange-500 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
          🍽️ 외식 기록
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">

          {/* ═══════ 식재료 탭 ═══════ */}
          {mainTab==='ingredient' && (
            <>
              {/* 등록 방법 */}
              <div className="soft-card p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">식재료 등록</h2>
                <p className="text-sm text-slate-500 mb-5">사진 인식 또는 직접 목록 입력으로 식재료를 추가하세요.</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={()=>setUploadTypeModal(true)} disabled={ocrLoading} className={`flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold shadow-sm transition-all ${activeMode==='ocr'?'bg-sage text-white':'bg-[#EDF7E7] text-sage hover:bg-sage hover:text-white'}`}>
                    {ocrLoading?<Loader2 size={18} className="animate-spin"/>:<Camera size={18}/>}
                    {ocrLoading?'분석 중...':'사진으로 인식'}
                  </button>
                  <input type="file" accept="image/*" className="hidden" ref={el=>setFileInputEl(el)} onChange={handleOcr}/>
                  <button type="button" onClick={()=>{setManualItems([{name:'',price:'',quantity:'',unit:'g'}]);setShowManual(true);setActiveMode('manual');setIsSubscription(false);setSubTotal('');setOcrItems(null);}} className={`flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold shadow-sm transition-all ${activeMode==='manual'&&!ocrItems?'bg-slate-900 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'}`}>
                    <Plus size={18}/> 직접 목록 입력
                  </button>
                </div>
                {successMsg&&<div className="mt-4 rounded-2xl bg-[#F4F8F1] px-4 py-3 text-sm font-medium text-sage">{successMsg}</div>}
              </div>

              {/* 편집 영역 */}
              {activeItems&&(
                <div className="soft-card p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">{activeMode==='ocr'?(ocrMode==='list'?'📋 리스트 인식':'🧾 영수증 인식'):'📝 직접 입력'}</h3>
                    <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                  </div>
                  <div className="rounded-2xl bg-[#F8FAF7] p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={isSubscription} onChange={e=>{setIsSubscription(e.target.checked);setSubTotal('');}} className="h-5 w-5 accent-sage"/>
                      <div><div className="font-semibold text-slate-900 text-sm">구독 서비스 (어글리어스 등)</div><div className="text-xs text-slate-500">전체 금액 ÷ 항목 수 자동 계산</div></div>
                    </label>
                    {isSubscription&&(
                      <div className="flex items-center gap-3">
                        <input type="number" min="0" step="0.01" placeholder="전체 구독 금액" value={subTotal} onChange={e=>setSubTotal(e.target.value)} className="input-base flex-1"/>
                        {subTotal&&activeItems.length>0&&<div className="text-sm text-sage font-semibold whitespace-nowrap">→ 항목당 {formatCurrency(Math.round(Number(subTotal)/activeItems.length))}</div>}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" className="input-base" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/>
                    <input className="input-base" placeholder="구매처" value={purchaseSource} onChange={e=>setPurchaseSource(e.target.value)}/>
                  </div>
                  <input className="input-base" placeholder="용도 (선택) — 예: 반찬용, 간식용" value={purchasePurpose} onChange={e=>setPurchasePurpose(e.target.value)}/>
                  <div className="space-y-3">
                    {activeItems.map((item,idx)=>(
                      <div key={idx} className="rounded-2xl border border-border bg-white p-3">
                        <div className={`grid gap-2 items-center ${activeMode==='manual'?'grid-cols-[1fr,80px,70px,60px,auto]':'grid-cols-[1fr,90px,70px,auto]'}`}>
                          <input className="input-base text-sm" placeholder="식재료명" value={item.name} onChange={e=>activeMode==='ocr'?updateOcr(idx,'name',e.target.value):updateManual(idx,'name',e.target.value)}/>
                          <input className="input-base text-sm" type="number" min="0" step="0.01" placeholder="가격" value={isSubscription&&subTotal?Math.round(Number(subTotal)/activeItems.length):item.price} disabled={isSubscription&&!!subTotal} onChange={e=>activeMode==='ocr'?updateOcr(idx,'price',e.target.value):updateManual(idx,'price',e.target.value)}/>
                          {activeMode==='manual'?(
                            <>
                              <input className="input-base text-sm" type="number" min="0.01" step="0.01" placeholder={item.unit==='개'?'개수':'g'} value={item.quantity} onChange={e=>updateManual(idx,'quantity',e.target.value)}/>
                              <select className="input-base text-sm px-2" value={item.unit} onChange={e=>updateManual(idx,'unit',e.target.value)}>
                                <option value="g">g</option><option value="개">개</option>
                              </select>
                            </>
                          ):(
                            <input className="input-base text-sm" type="number" min="0.01" step="0.01" placeholder="g" value={item.grams} onChange={e=>updateOcr(idx,'grams',e.target.value)}/>
                          )}
                          <button type="button" onClick={()=>activeMode==='ocr'?removeOcr(idx):removeManual(idx)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral hover:bg-coral hover:text-white transition-colors"><Trash2 size={15}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={()=>activeMode==='ocr'?setOcrItems(p=>[...p,{name:'',price:0,grams:200,unit:'g'}]):setManualItems(p=>[...p,{name:'',price:'',quantity:'',unit:'g'}])} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-2 text-sm text-slate-500 hover:border-sage hover:text-sage"><Plus size={16}/> 항목 추가</button>
                    <div className="flex-1"/>
                    <button type="button" onClick={cancelEdit} className="rounded-2xl border border-border px-5 py-2.5 text-sm font-semibold text-slate-500">취소</button>
                    <button type="button" onClick={saveItems} disabled={savingItems||computedItems.filter(i=>i.name?.trim()).length===0} className="rounded-2xl bg-sage px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      {savingItems?'저장 중...':`${computedItems.filter(i=>i.name?.trim()).length}개 저장`}
                    </button>
                  </div>
                </div>
              )}

              {/* 식재료 구매 내역 */}
              <div className="soft-card p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">식재료 구매 내역</h2>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">시작일</label><input type="date" className="input-base" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">종료일</label><input type="date" className="input-base" value={filterTo} onChange={e=>setFilterTo(e.target.value)}/></div>
                  <button onClick={handlePeriodSearch} disabled={!filterFrom&&!filterTo} className="rounded-2xl bg-sage px-4 py-3 font-semibold text-white disabled:opacity-40">조회</button>
                  {showHistory&&<button onClick={()=>{setShowHistory(false);setPurchases([]);setSelectedIds(new Set());}} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-slate-500">초기화</button>}
                </div>
                {!showHistory?(
                  <div className="rounded-2xl bg-[#FCFCFC] py-8 text-center text-sm text-slate-400">날짜 범위를 입력하고 조회하면 내역이 표시됩니다.</div>
                ):(
                  <>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-sage">
                          {allSelected?<CheckSquare size={16} className="text-sage"/>:<Square size={16}/>}
                          {allSelected?'전체해제':'전체선택'}
                        </button>
                        {selectedIds.size>0&&(
                          <button onClick={bulkDelete} disabled={bulkDeleting} className="flex items-center gap-1.5 rounded-xl bg-[#FFF0F0] px-3 py-1.5 text-sm font-semibold text-coral hover:bg-coral hover:text-white disabled:opacity-50">
                            <Trash2 size={14}/>{bulkDeleting?'삭제 중...':`선택 삭제 (${selectedIds.size}개)`}
                          </button>
                        )}
                      </div>
                      <div className="text-right"><div className="text-xs text-slate-400">누적 지출</div><div className="text-xl font-black text-sage">{formatCurrency(totalSpent)}</div></div>
                    </div>
                    <div className="divide-y divide-border">
                      {purchases.length===0?(<div className="py-6 text-center text-sm text-slate-400">구매 내역이 없습니다.</div>)
                      :purchases.map(p=>(
                        <div key={p.id} className="flex items-center gap-3 py-4">
                          <button type="button" onClick={()=>toggleSelect(p.id)} className="flex-shrink-0">{selectedIds.has(p.id)?<CheckSquare size={18} className="text-sage"/>:<Square size={18} className="text-slate-300"/>}</button>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900">{p.itemName}</div>
                            <div className="mt-1 text-xs text-slate-400">{formatDate(p.date)} · {p.source}{p.purpose?` · ${p.purpose}`:''}</div>
                          </div>
                          <div className="text-right mr-2"><div className="font-bold text-slate-900">{formatCurrency(p.price)}</div><div className="text-xs text-slate-500">{formatUnitDisplay(p.grams, p.unitType)}</div></div>
                          <button onClick={()=>openEdit(p)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF7E7] text-sage hover:bg-sage hover:text-white transition-colors flex-shrink-0"><Edit2 size={14}/></button>
                          <button onClick={()=>deletePurchase(p.id)} disabled={deletingId===p.id} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral hover:bg-coral hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ═══════ 외식 탭 ═══════ */}
          {mainTab==='dining' && (
            <>
              {/* 외식 기록 입력 */}
              <div className="soft-card p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2"><UtensilsCrossed size={20} className="text-orange-500"/> 외식 기록</h2>
                <p className="text-sm text-slate-500 mb-5">식당명과 메뉴, 가격을 기록해 두면 식단일기에서 선택할 수 있어요.</p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">음식·메뉴명 *</label>
                    <input className="input-base" placeholder="예: 돼지국밥, 김치찌개 정식" value={diningForm.itemName} onChange={e=>setDiningForm(p=>({...p,itemName:e.target.value}))}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-500">식당명</label>
                      <input className="input-base" placeholder="예: 순이네 국밥" value={diningForm.source} onChange={e=>setDiningForm(p=>({...p,source:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-500">가격 (원)</label>
                      <input type="number" className="input-base" placeholder="9000" value={diningForm.price} onChange={e=>setDiningForm(p=>({...p,price:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-500">날짜</label>
                      <input type="date" className="input-base" value={diningForm.date} onChange={e=>setDiningForm(p=>({...p,date:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-500">메모 (선택)</label>
                      <input className="input-base" placeholder="예: 회식, 가족외식" value={diningForm.purpose} onChange={e=>setDiningForm(p=>({...p,purpose:e.target.value}))}/>
                    </div>
                  </div>
                  {diningSuccess&&<div className="rounded-2xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm font-medium text-orange-700">{diningSuccess}</div>}
                  <button onClick={saveDining} disabled={savingDining||!diningForm.itemName.trim()} className="w-full rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white disabled:opacity-60">
                    {savingDining?'저장 중...':'🍽️ 외식 기록 저장'}
                  </button>
                </div>
              </div>

              {/* 외식 내역 조회 */}
              <div className="soft-card p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">외식 내역</h2>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">시작일</label><input type="date" className="input-base" value={diningFilterFrom} onChange={e=>setDiningFilterFrom(e.target.value)}/></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-500">종료일</label><input type="date" className="input-base" value={diningFilterTo} onChange={e=>setDiningFilterTo(e.target.value)}/></div>
                  <button onClick={handleDiningSearch} className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white">조회</button>
                  {showDiningHistory&&<button onClick={()=>{setShowDiningHistory(false);setDiningRecords([]);}} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-slate-500">초기화</button>}
                </div>
                {!showDiningHistory?(
                  <div className="rounded-2xl bg-[#FCFCFC] py-8 text-center text-sm text-slate-400">날짜 범위를 입력하고 조회하면 내역이 표시됩니다.</div>
                ):(
                  <div className="divide-y divide-border">
                    {diningRecords.length===0?(<div className="py-6 text-center text-sm text-slate-400">외식 기록이 없습니다.</div>)
                    :diningRecords.map(p=>(
                      <div key={p.id} className="flex items-center gap-3 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🍽️</span>
                            <div>
                              <div className="font-bold text-slate-900">{p.itemName}</div>
                              <div className="text-xs text-slate-400">{formatDate(p.date)} · {p.source}{p.purpose?` · ${p.purpose}`:''}</div>
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-orange-500 mr-2">{p.price>0?formatCurrency(p.price):'-'}</div>
                        <button onClick={()=>openEditDining(p)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors flex-shrink-0"><Edit2 size={14}/></button>
                        <button onClick={()=>deleteDining(p.id)} disabled={deletingDiningId===p.id} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral hover:bg-coral hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* 영양정보 검색 (공통) */}
        <section className="soft-card h-fit p-6">
          <div className="text-xl font-bold text-slate-900">영양정보 검색</div>
          <p className="mt-2 text-sm text-slate-500">검색 결과를 클릭하면 영양정보에 저장합니다.</p>
          <div className="mt-4 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleSearch();}}} className="input-base pl-11" placeholder="예: 바나나, 두부"/>
            </div>
            <button type="button" onClick={handleSearch} disabled={apiLoading} className="rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{apiLoading?'검색중':'검색'}</button>
          </div>
          {apiMsg&&<div className="mt-4 rounded-2xl bg-[#F8FAF7] px-4 py-3 text-sm text-slate-500">{apiMsg}</div>}
          {askAddPurchase&&(
            <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <div className="text-sm font-semibold text-amber-900 mb-3">'{askAddPurchase.name}'를 구매내역에도 추가할까요?</div>
              <div className="flex gap-2">
                <button onClick={addNutritionToPurchases} className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-white">구매내역 추가</button>
                <button onClick={()=>setAskAddPurchase(null)} className="flex-1 rounded-xl border border-amber-200 py-2 text-sm font-semibold text-amber-700">나중에</button>
              </div>
            </div>
          )}
          {apiResults.length>0&&(
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
              {apiResults.map((food,i)=>(
                <button key={`${food.name}-${i}`} type="button" onClick={()=>selectNutrition(food)} disabled={savingFood===food.name} className="block w-full border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-[#F8FAF7] disabled:opacity-60">
                  <span className="font-bold text-slate-900">{food.name||'이름 없음'}</span><span className="ml-2 font-semibold text-sage">{food.calories||0}kcal</span>
                  <span className="mt-1 block text-xs text-slate-400">탄수 {food.carbs||0}g · 단백질 {food.protein||0}g · 지방 {food.fat||0}g</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 space-y-4">
            {nutrition.length===0?(<div className="rounded-[24px] bg-[#FCFCFC] p-4 text-center text-sm text-slate-400">저장된 영양정보가 없습니다.</div>)
            :nutrition.map(entry=>(
              <div key={entry.id} className="rounded-[24px] bg-[#FCFCFC] p-4">
                <div className="font-bold text-slate-900">{entry.name} (100g 기준)</div>
                <div className="mt-3 text-3xl font-extrabold text-sage">{entry.calories}<span className="ml-1 text-sm font-semibold text-slate-400">kcal</span></div>
                <div className="mt-3 text-sm text-slate-500">단백질 {entry.protein}g · 탄수 {entry.carbs}g · 지방 {entry.fat}g</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 사진 타입 선택 */}
      <Modal open={uploadTypeModal} onClose={()=>setUploadTypeModal(false)} title="사진 인식 방법 선택" className="max-w-sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">어떤 사진을 인식할까요?</p>
          <button type="button" onClick={()=>handleUploadTypeSelect('photo','receipt')} className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-[#F8FAF7] p-4 hover:border-sage hover:bg-[#EDF7E7] transition-colors">
            <FileText size={28} className="text-sage flex-shrink-0"/>
            <div className="text-left"><div className="font-bold text-slate-900">영수증</div><div className="mt-0.5 text-xs text-slate-500">마트·시장 영수증 사진으로 식재료와 가격을 자동 인식</div></div>
          </button>
          <button type="button" onClick={()=>handleUploadTypeSelect('photo','list')} className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-slate-50 p-4 hover:border-slate-400 hover:bg-slate-100 transition-colors">
            <List size={28} className="text-slate-600 flex-shrink-0"/>
            <div className="text-left"><div className="font-bold text-slate-900">리스트</div><div className="mt-0.5 text-xs text-slate-500">손글씨 메모나 쇼핑리스트 사진에서 재료명과 양을 인식</div></div>
          </button>
        </div>
      </Modal>

      {/* 식재료 수정 */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title="구매 내역 수정" className="max-w-lg">
        <div className="space-y-4">
          <div><label className="mb-1 block text-xs font-bold text-slate-500">식재료명</label><input className="input-base" value={editForm.itemName} onChange={e=>setEditForm(p=>({...p,itemName:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">가격 (원)</label><input type="number" step="0.01" className="input-base" value={editForm.price} onChange={e=>setEditForm(p=>({...p,price:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">용량 (g)</label><input type="number" step="0.01" className="input-base" value={editForm.grams} onChange={e=>setEditForm(p=>({...p,grams:e.target.value}))}/></div>
          </div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">구매처</label><input className="input-base" value={editForm.source} onChange={e=>setEditForm(p=>({...p,source:e.target.value}))}/></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">용도</label><input className="input-base" placeholder="예: 반찬용" value={editForm.purpose} onChange={e=>setEditForm(p=>({...p,purpose:e.target.value}))}/></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">구매일</label><input type="date" className="input-base" value={editForm.date} onChange={e=>setEditForm(p=>({...p,date:e.target.value}))}/></div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setEditModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button onClick={submitEdit} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white">저장</button>
          </div>
        </div>
      </Modal>

      {/* 외식 수정 */}
      <Modal open={editDiningModal} onClose={()=>setEditDiningModal(false)} title="외식 기록 수정" className="max-w-lg">
        <div className="space-y-4">
          <div><label className="mb-1 block text-xs font-bold text-slate-500">음식·메뉴명</label><input className="input-base" value={editDiningForm.itemName} onChange={e=>setEditDiningForm(p=>({...p,itemName:e.target.value}))}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">식당명</label><input className="input-base" value={editDiningForm.source} onChange={e=>setEditDiningForm(p=>({...p,source:e.target.value}))}/></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">가격 (원)</label><input type="number" className="input-base" value={editDiningForm.price} onChange={e=>setEditDiningForm(p=>({...p,price:e.target.value}))}/></div>
          </div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">날짜</label><input type="date" className="input-base" value={editDiningForm.date} onChange={e=>setEditDiningForm(p=>({...p,date:e.target.value}))}/></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">메모</label><input className="input-base" value={editDiningForm.purpose} onChange={e=>setEditDiningForm(p=>({...p,purpose:e.target.value}))}/></div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setEditDiningModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button onClick={submitEditDining} className="flex-1 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
