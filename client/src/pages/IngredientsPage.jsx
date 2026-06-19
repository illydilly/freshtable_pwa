import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, Edit2, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrency, formatDate, getStatusTone } from '../lib/utils';

const filters = ['전체', '신선', '빨리 먹기', '긴급'];
const mealTypes = ['아침', '점심', '저녁', '간식'];
const today = () => new Date().toISOString().slice(0, 10);
const emptyPurchase = { itemName: '', price: '', grams: '', source: '', date: today() };

// ── #1: 클라이언트에서 항상 purchase.grams 기준으로 계산 ──────────────
// ingredient.totalGrams는 DB 동기화 지연이 있을 수 있으므로 purchase.grams를 SSoT로 사용
function getClientTotal(item) {
  return item?.purchase?.grams ?? item?.totalGrams ?? 0;
}
function getClientUsed(item) {
  return item?.usedGrams ?? 0;
}
function getClientRemaining(item) {
  return Math.max(getClientTotal(item) - getClientUsed(item), 0);
}
function getClientPercent(item) {
  const total = getClientTotal(item);
  return total > 0 ? Math.round((getClientRemaining(item) / total) * 100) : 0;
}

function ExpiryBadge({ expiryInfo }) {
  if (!expiryInfo) return null;
  const colorMap = {
    expired: 'bg-red-900 text-white',
    danger: 'bg-red-500 text-white',
    warning: 'bg-amber-400 text-amber-900',
    safe: 'bg-emerald-100 text-emerald-700'
  };
  const icon = expiryInfo.color === 'expired' ? '🚨' : expiryInfo.color === 'danger' ? '🔴' : expiryInfo.color === 'warning' ? '⚠️' : '✅';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colorMap[expiryInfo.color] || 'bg-slate-100 text-slate-600'}`}>
      {icon} {expiryInfo.label}
    </span>
  );
}

export function IngredientsPage() {
  const [filter, setFilter] = useState('전체');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [usageModal, setUsageModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [expiryModal, setExpiryModal] = useState(false);
  const [editUsageModal, setEditUsageModal] = useState(false);
  const [editPurchaseModal, setEditPurchaseModal] = useState(false);
  const [editIngredientModal, setEditIngredientModal] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [savingIngredientInfo, setSavingIngredientInfo] = useState(false);
  const [consumingId, setConsumingId] = useState(null); // #4

  const [usageForm, setUsageForm] = useState({ date: today(), menuName: '', gramsUsed: '', mealType: '', useRecipe: false, recipeId: '' });
  const [editUsageForm, setEditUsageForm] = useState({ id: null, date: today(), menuName: '', gramsUsed: '', mealType: '' });
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [editPurchaseForm, setEditPurchaseForm] = useState({ ...emptyPurchase, _id: null });
  const [expiryForm, setExpiryForm] = useState({ expiryDate: '', storageNote: '' });
  const [editIngredientForm, setEditIngredientForm] = useState({ name: '', purpose: '' });
  const [editIngredientId, setEditIngredientId] = useState(null);

  const loadIngredients = async (targetFilter = filter, preferredId = selected?.id) => {
    const res = await api.get('/ingredients', { params: targetFilter === '전체' ? {} : { status: targetFilter } });
    setItems(res.data);
    const nextId = preferredId && res.data.some(i => i.id === preferredId) ? preferredId : res.data[0]?.id;
    if (nextId) { const detail = await api.get(`/ingredients/${nextId}`); setSelected(detail.data); }
    else setSelected(null);
  };

  useEffect(() => {
    loadIngredients();
    api.get('/recipes').then(r => setRecipes(r.data));
  }, []);

  const counts = useMemo(() => {
    const map = { 전체: 0, 신선: 0, '빨리 먹기': 0, 긴급: 0 };
    items.forEach(item => {
      if (getClientRemaining(item) <= 0) return; // 소진된 재료는 카운트 제외
      map['전체']++;
      map[item.status] = (map[item.status] || 0) + 1;
    });
    return map;
  }, [items]);

  // #1: 클라이언트 remaining 기준으로 필터 + 유통기한 짧은 순 정렬
  const sortedItems = useMemo(() => {
    return [...items]
      .filter(item => getClientRemaining(item) > 0) // #3: 소진된 재료 자동 숨김
      .sort((a, b) => {
        const da = a.expiryInfo?.daysUntil ?? 9999;
        const db = b.expiryInfo?.daysUntil ?? 9999;
        if (da !== db) return da - db;
        return new Date(a.purchase?.date || 0) - new Date(b.purchase?.date || 0);
      });
  }, [items]);

  const consumedCount = useMemo(() => items.filter(i => getClientRemaining(i) <= 0).length, [items]);

  const selectIngredient = async id => {
    const r = await api.get(`/ingredients/${id}`);
    setSelected(r.data);
  };
  const changeFilter = async entry => { setFilter(entry); await loadIngredients(entry); };

  // ── #4: 소진완료 버튼 ──────────────────────────────────────────────
  const consumeIngredient = async (item, e) => {
    e.stopPropagation();
    const remaining = getClientRemaining(item);
    if (remaining <= 0) return;
    if (!confirm(`'${item.name}' ${remaining}g를 소진 완료 처리할까요?`)) return;
    setConsumingId(item.id);
    try {
      await api.post(`/ingredients/${item.id}/usage`, {
        date: today(),
        menuName: '소진완료',
        gramsUsed: remaining,
        mealType: null
      });
      if (selected?.id === item.id) setSelected(null);
      await loadIngredients(filter);
    } finally { setConsumingId(null); }
  };

  // ── 사용내역 ──────────────────────────────────────────────────────
  const openUsageModal = () => {
    setUsageForm({ date: today(), menuName: '', gramsUsed: '', mealType: '', useRecipe: false, recipeId: '' });
    setUsageModal(true);
  };

  const submitUsage = async e => {
    e.preventDefault();
    let menuName = usageForm.menuName;
    if (usageForm.useRecipe && usageForm.recipeId) {
      const r = recipes.find(r => String(r.id) === String(usageForm.recipeId));
      if (r) menuName = r.name;
    }
    await api.post(`/ingredients/${selected.id}/usage`, {
      date: usageForm.date, menuName, gramsUsed: Number(usageForm.gramsUsed), mealType: usageForm.mealType || null
    });
    setUsageModal(false);
    setUsageForm({ date: today(), menuName: '', gramsUsed: '', mealType: '', useRecipe: false, recipeId: '' });
    await loadIngredients(filter, selected.id);
  };

  const openEditUsage = entry => {
    setEditUsageForm({ id: entry.id, date: entry.date?.slice(0, 10) || today(), menuName: entry.menuName, gramsUsed: entry.gramsUsed, mealType: entry.mealType || '' });
    setEditUsageModal(true);
  };

  const submitEditUsage = async e => {
    e.preventDefault(); setSavingUsage(true);
    try {
      await api.put(`/ingredients/${selected.id}/usage/${editUsageForm.id}`, {
        date: editUsageForm.date, menuName: editUsageForm.menuName,
        gramsUsed: Number(editUsageForm.gramsUsed), mealType: editUsageForm.mealType || null
      });
      setEditUsageModal(false); await loadIngredients(filter, selected.id);
    } finally { setSavingUsage(false); }
  };

  const deleteUsage = async usageId => {
    if (!confirm('사용 내역을 삭제할까요?')) return;
    await api.delete(`/ingredients/${selected.id}/usage/${usageId}`);
    await loadIngredients(filter, selected.id);
  };

  // ── 구매/편집 ─────────────────────────────────────────────────────
  const openEditPurchase = () => {
    const p = selected?.purchase; if (!p) return;
    setEditPurchaseForm({ _id: p.id, itemName: p.itemName, price: String(p.price), grams: String(p.grams), source: p.source, date: new Date(p.date).toISOString().slice(0, 10) });
    setEditPurchaseModal(true);
  };

  const submitEditPurchase = async e => {
    e.preventDefault(); setSavingPurchase(true);
    try {
      await api.put(`/purchases/${editPurchaseForm._id}`, {
        itemName: editPurchaseForm.itemName, price: Number(editPurchaseForm.price),
        grams: Number(editPurchaseForm.grams), source: editPurchaseForm.source, date: editPurchaseForm.date
      });
      setEditPurchaseModal(false); await loadIngredients(filter, selected.id);
    } finally { setSavingPurchase(false); }
  };

  const openExpiryModal = () => {
    setExpiryForm({ expiryDate: selected.expiryDate ? new Date(selected.expiryDate).toISOString().slice(0, 10) : '', storageNote: selected.storageNote || '' });
    setExpiryModal(true);
  };

  const submitExpiry = async e => {
    e.preventDefault(); setSavingExpiry(true);
    try {
      await api.patch(`/ingredients/${selected.id}`, { expiryDate: expiryForm.expiryDate || null, storageNote: expiryForm.storageNote || null });
      setExpiryModal(false); await loadIngredients(filter, selected.id);
    } finally { setSavingExpiry(false); }
  };

  const submitPurchase = async e => {
    e.preventDefault(); setSavingPurchase(true);
    try {
      await api.post('/purchases/bulk', { items: [{ itemName: purchaseForm.itemName.trim(), price: Number(purchaseForm.price) || 0, grams: Number(purchaseForm.grams) || 0, source: purchaseForm.source.trim(), date: purchaseForm.date }] });
      setPurchaseModal(false); setPurchaseForm(emptyPurchase); await loadIngredients(filter);
    } finally { setSavingPurchase(false); }
  };

  const openEditIngredient = item => {
    setEditIngredientId(item.id);
    setEditIngredientForm({ name: item.name, purpose: item.purchase?.purpose || '' });
    setEditIngredientModal(true);
  };

  const submitEditIngredient = async e => {
    e.preventDefault(); setSavingIngredientInfo(true);
    try {
      await api.patch(`/ingredients/${editIngredientId}/info`, { name: editIngredientForm.name.trim(), purpose: editIngredientForm.purpose.trim() || null });
      setEditIngredientModal(false); await loadIngredients(filter, editIngredientId);
    } finally { setSavingIngredientInfo(false); }
  };

  const deleteIngredient = async item => {
    if (!confirm(`'${item.name}' 식재료를 삭제하면 구매내역과 사용내역도 모두 삭제됩니다. 계속할까요?`)) return;
    await api.delete(`/ingredients/${item.id}`);
    if (selected?.id === item.id) setSelected(null);
    await loadIngredients(filter);
  };

  // ── 선택된 재료의 클라이언트 계산값 ────────────────────────────────
  const selTotal = selected ? getClientTotal(selected) : 0;
  const selUsed = selected ? getClientUsed(selected) : 0;
  const selRemaining = Math.max(selTotal - selUsed, 0);

  return (
    <div>
      <PageHeader title="식재료 인벤토리"
        subtitle="구매 기록과 사용 내역을 연결해 남은 재고를 정확하게 추적해요."
        action={
          <button type="button" onClick={() => setPurchaseModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-sage px-5 py-3 font-semibold text-white shadow-sm">
            <ShoppingBag size={18} /> 새 구매 등록
          </button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr,400px]">

        {/* ── 재료 목록 ── */}
        <section className="soft-card p-6">
          <div className="mb-5 flex flex-wrap gap-3">
            {filters.map(entry => (
              <button key={entry} type="button" onClick={() => changeFilter(entry)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === entry ? 'bg-[#EDF7E7] text-sage' : 'bg-[#F8FAFC] text-slate-500'}`}>
                {entry} {counts[entry] ?? 0}
              </button>
            ))}
          </div>

          {consumedCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-400">
              <CheckCircle size={13} />
              <span>소진된 재료 <strong className="text-slate-600">{consumedCount}개</strong>가 목록에서 자동으로 숨겨졌습니다.</span>
            </div>
          )}

          <div className="space-y-4">
            {sortedItems.length === 0 ? (
              <div className="rounded-[24px] bg-[#FCFCFC] p-6 text-sm text-slate-500">등록된 식재료가 없어요.</div>
            ) : sortedItems.map(item => {
              const remaining = getClientRemaining(item);
              const percent = getClientPercent(item);
              return (
                <div key={item.id} className={`rounded-[26px] border transition ${selected?.id === item.id ? 'border-sage bg-[#F8FBF6]' : 'border-border bg-white'}`}>
                  <button type="button" onClick={() => selectIngredient(item.id)} className="w-full p-5 text-left">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-slate-900">{item.name}</div>
                        {/* #1: 클라이언트 계산값으로 표시 */}
                        <div className="mt-1 text-sm text-slate-500">남은 재고 <strong>{remaining}g</strong></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* #4: 소진완료 버튼 — 노란 네모 위치 */}
                        <button
                          type="button"
                          onClick={e => consumeIngredient(item, e)}
                          disabled={consumingId === item.id}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:border-sage hover:bg-[#EDF7E7] hover:text-sage transition-all disabled:opacity-50"
                        >
                          {consumingId === item.id ? '처리 중...' : '소진완료'}
                        </button>
                        {item.expiryInfo && <ExpiryBadge expiryInfo={item.expiryInfo} />}
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(item.status)}`}>{item.status}</span>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${item.status === '긴급' ? 'bg-coral' : item.status === '빨리 먹기' ? 'bg-[#F1B44C]' : 'bg-sage'}`}
                        style={{ width: `${Math.max(percent, 4)}%` }}
                      />
                    </div>
                  </button>
                  <div className="flex items-center justify-end gap-2 px-5 pb-4">
                    <button type="button" onClick={() => openEditIngredient(item)}
                      className="flex items-center gap-1 rounded-xl bg-[#EDF7E7] px-3 py-1.5 text-xs font-semibold text-sage hover:bg-sage hover:text-white transition-colors">
                      <Edit2 size={12} /> 편집
                    </button>
                    <button type="button" onClick={() => deleteIngredient(item)}
                      className="flex items-center gap-1 rounded-xl bg-[#FFF0F0] px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral hover:text-white transition-colors">
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 상세 패널 ── */}
        <section className="soft-card p-6 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900">{selected.name} 상세</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={openExpiryModal}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF8EC] text-amber-500 hover:bg-amber-100">
                    <CalendarDays size={18} />
                  </button>
                  <button type="button" onClick={openUsageModal}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage">
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* #1: 구매 정보 — purchase.grams 기준으로 직접 계산 */}
              {selected.purchase && (
                <div className="mt-4 rounded-2xl border border-border bg-[#FCFCFC] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-slate-700">구매 정보</div>
                    <button type="button" onClick={openEditPurchase}
                      className="flex items-center gap-1 rounded-xl bg-[#EDF7E7] px-3 py-1.5 text-xs font-semibold text-sage hover:bg-sage hover:text-white">
                      <Edit2 size={12} /> 수정
                    </button>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><span className="text-slate-400">구매일</span><span>{formatDate(selected.purchase.date)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">구매처</span><span>{selected.purchase.source}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">가격</span><span className="font-semibold">{formatCurrency(selected.purchase.price)}</span></div>
                    {/* 총 구매량 = purchase.grams (항상 최신) */}
                    <div className="flex justify-between"><span className="text-slate-400">총 구매량</span><span>{selTotal}g</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">총 사용량</span><span>{selUsed}g</span></div>
                    {/* 남은 재고 = 총 구매량 - 총 사용량 (클라이언트 직접 계산) */}
                    <div className="flex justify-between border-t border-border mt-1 pt-1">
                      <span className="font-semibold text-slate-600">남은 재고</span>
                      <span className="font-bold text-sage">{selRemaining}g</span>
                    </div>
                    {selected.purchase.purpose && (
                      <div className="flex justify-between"><span className="text-slate-400">용도</span><span>{selected.purchase.purpose}</span></div>
                    )}
                  </div>
                </div>
              )}

              {(selected.expiryDate || selected.storageNote) && (
                <div className={`mt-4 rounded-2xl p-3 text-sm ${
                  selected.expiryInfo?.color === 'expired' || selected.expiryInfo?.color === 'danger'
                    ? 'bg-red-50 border border-red-200'
                    : selected.expiryInfo?.color === 'warning'
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-[#F4F8F1] border border-[#D4EDCE]'
                }`}>
                  {selected.expiryDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">유통기한 {formatDate(selected.expiryDate)}</span>
                      {selected.expiryInfo && <ExpiryBadge expiryInfo={selected.expiryInfo} />}
                    </div>
                  )}
                  {selected.storageNote && <div className="mt-1 text-slate-500">{selected.storageNote}</div>}
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-bold text-slate-900">사용 내역</h3>
                <div className="mt-4 space-y-3">
                  {selected.usageHistory.length === 0 ? (
                    <div className="rounded-[20px] bg-[#FCFCFC] px-4 py-3 text-sm text-slate-500">아직 사용 기록이 없어요.</div>
                  ) : selected.usageHistory.map(entry => (
                    <div key={entry.id} className="flex items-center gap-2 rounded-[20px] bg-[#FCFCFC] px-4 py-3 text-sm text-slate-600">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900">
                          {formatDate(entry.date, 'MM.dd')}
                          {entry.mealType && <span className="ml-1.5 rounded-full bg-[#EDF7E7] px-2 py-0.5 text-xs text-sage">{entry.mealType}</span>}
                          {' · '}{entry.menuName}
                        </div>
                        <div className="mt-0.5">{entry.gramsUsed}g 사용</div>
                      </div>
                      <button onClick={() => openEditUsage(entry)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDF7E7] text-sage hover:bg-sage hover:text-white transition-colors flex-shrink-0">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteUsage(entry.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF0F0] text-coral hover:bg-coral hover:text-white transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-slate-400">식재료를 선택하면 상세 정보가 표시돼요.</div>
          )}
        </section>
      </div>

      {/* 새 구매 등록 */}
      <Modal open={purchaseModal} onClose={() => setPurchaseModal(false)} title="새 구매 등록" className="max-w-xl">
        <form onSubmit={submitPurchase} className="space-y-4">
          <input required className="input-base" placeholder="식재료 이름" value={purchaseForm.itemName} onChange={e => setPurchaseForm(p => ({ ...p, itemName: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className="input-base" type="number" min="0" step="0.01" placeholder="가격" value={purchaseForm.price} onChange={e => setPurchaseForm(p => ({ ...p, price: e.target.value }))} />
            <input required className="input-base" type="number" min="1" step="0.01" placeholder="그램 수" value={purchaseForm.grams} onChange={e => setPurchaseForm(p => ({ ...p, grams: e.target.value }))} />
          </div>
          <input required className="input-base" placeholder="구매처" value={purchaseForm.source} onChange={e => setPurchaseForm(p => ({ ...p, source: e.target.value }))} />
          <input required type="date" className="input-base" value={purchaseForm.date} onChange={e => setPurchaseForm(p => ({ ...p, date: e.target.value }))} />
          <button disabled={savingPurchase} className="w-full rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">
            {savingPurchase ? '저장 중...' : '구매 저장'}
          </button>
        </form>
      </Modal>

      {/* 사용 내역 추가 */}
      <Modal open={usageModal} onClose={() => setUsageModal(false)} title="사용 내역 추가" className="max-w-xl">
        <form onSubmit={submitUsage} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">사용 날짜</label>
            <input type="date" className="input-base" value={usageForm.date} onChange={e => setUsageForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-500">식사 시점 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {mealTypes.map(t => (
                <button key={t} type="button" onClick={() => setUsageForm(p => ({ ...p, mealType: p.mealType === t ? '' : t }))}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${usageForm.mealType === t ? 'bg-sage text-white' : 'bg-slate-100 text-slate-600 hover:bg-[#EDF7E7]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500">메뉴명</label>
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={usageForm.useRecipe} onChange={e => setUsageForm(p => ({ ...p, useRecipe: e.target.checked, menuName: '', recipeId: '' }))} className="accent-sage" />
                레시피 목록에서 선택
              </label>
            </div>
            {usageForm.useRecipe ? (
              <select required className="input-base" value={usageForm.recipeId} onChange={e => setUsageForm(p => ({ ...p, recipeId: e.target.value }))}>
                <option value="">레시피 선택...</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : (
              <input required className="input-base" placeholder="사용한 메뉴 이름" value={usageForm.menuName} onChange={e => setUsageForm(p => ({ ...p, menuName: e.target.value }))} />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">사용량 (g)</label>
            <input required className="input-base" type="number" min="0.01" step="0.01" placeholder="그램 수" value={usageForm.gramsUsed} onChange={e => setUsageForm(p => ({ ...p, gramsUsed: e.target.value }))} />
          </div>
          <button className="w-full rounded-2xl bg-sage px-5 py-3 font-semibold text-white">저장하기</button>
        </form>
      </Modal>

      {/* 사용 내역 수정 */}
      <Modal open={editUsageModal} onClose={() => setEditUsageModal(false)} title="사용 내역 수정" className="max-w-xl">
        <form onSubmit={submitEditUsage} className="space-y-4">
          <input type="date" className="input-base" value={editUsageForm.date} onChange={e => setEditUsageForm(p => ({ ...p, date: e.target.value }))} />
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-500">식사 시점</label>
            <div className="flex flex-wrap gap-2">
              {mealTypes.map(t => (
                <button key={t} type="button" onClick={() => setEditUsageForm(p => ({ ...p, mealType: p.mealType === t ? '' : t }))}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${editUsageForm.mealType === t ? 'bg-sage text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input required className="input-base" placeholder="메뉴 이름" value={editUsageForm.menuName} onChange={e => setEditUsageForm(p => ({ ...p, menuName: e.target.value }))} />
          <input required className="input-base" type="number" min="0.01" step="0.01" placeholder="사용량 (g)" value={editUsageForm.gramsUsed} onChange={e => setEditUsageForm(p => ({ ...p, gramsUsed: e.target.value }))} />
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditUsageModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button disabled={savingUsage} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">{savingUsage ? '저장 중...' : '수정 저장'}</button>
          </div>
        </form>
      </Modal>

      {/* 구매내역 수정 */}
      <Modal open={editPurchaseModal} onClose={() => setEditPurchaseModal(false)} title="구매 정보 수정" className="max-w-xl">
        <form onSubmit={submitEditPurchase} className="space-y-4">
          <div><label className="mb-1 block text-xs font-bold text-slate-500">식재료명</label><input className="input-base" value={editPurchaseForm.itemName} onChange={e => setEditPurchaseForm(p => ({ ...p, itemName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-bold text-slate-500">가격 (원)</label><input type="number" step="0.01" className="input-base" value={editPurchaseForm.price} onChange={e => setEditPurchaseForm(p => ({ ...p, price: e.target.value }))} /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-500">용량 (g)</label><input type="number" step="0.01" className="input-base" value={editPurchaseForm.grams} onChange={e => setEditPurchaseForm(p => ({ ...p, grams: e.target.value }))} /></div>
          </div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">구매처</label><input className="input-base" value={editPurchaseForm.source} onChange={e => setEditPurchaseForm(p => ({ ...p, source: e.target.value }))} /></div>
          <div><label className="mb-1 block text-xs font-bold text-slate-500">구매일</label><input type="date" className="input-base" value={editPurchaseForm.date} onChange={e => setEditPurchaseForm(p => ({ ...p, date: e.target.value }))} /></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditPurchaseModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button disabled={savingPurchase} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">{savingPurchase ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </Modal>

      {/* 유통기한 */}
      <Modal open={expiryModal} onClose={() => setExpiryModal(false)} title="유통기한 & 보관 정보" className="max-w-xl">
        <form onSubmit={submitExpiry} className="space-y-4">
          <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">유통기한</label><input type="date" className="input-base" value={expiryForm.expiryDate} onChange={e => setExpiryForm(p => ({ ...p, expiryDate: e.target.value }))} /><p className="mt-1 text-xs text-slate-400">비워두면 구매 후 14일 기준으로 알림을 발송합니다.</p></div>
          <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">권장 보관 메모 (선택)</label><input className="input-base" placeholder="예: 냉장 3~5일, 냉동 1개월" value={expiryForm.storageNote} onChange={e => setExpiryForm(p => ({ ...p, storageNote: e.target.value }))} /></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setExpiryModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button disabled={savingExpiry} className="flex-1 rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white disabled:opacity-60">{savingExpiry ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </Modal>

      {/* 식재료 편집 */}
      <Modal open={editIngredientModal} onClose={() => setEditIngredientModal(false)} title="식재료 정보 수정" className="max-w-md">
        <form onSubmit={submitEditIngredient} className="space-y-4">
          <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">식재료 이름</label><input required className="input-base" value={editIngredientForm.name} onChange={e => setEditIngredientForm(p => ({ ...p, name: e.target.value }))} /><p className="mt-1 text-xs text-slate-400">이름 변경 시 구매내역·장보기리스트도 자동 반영됩니다.</p></div>
          <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">용도 (선택)</label><input className="input-base" value={editIngredientForm.purpose} onChange={e => setEditIngredientForm(p => ({ ...p, purpose: e.target.value }))} placeholder="예: 반찬용, 간식용" /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditIngredientModal(false)} className="flex-1 rounded-2xl border border-border px-5 py-3 font-semibold text-slate-500">취소</button>
            <button disabled={savingIngredientInfo} className="flex-1 rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">{savingIngredientInfo ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
