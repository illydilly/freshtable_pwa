import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChefHat, Download, FileSpreadsheet, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/utils';
import { loadRechartsFromCdn } from '../lib/loadRecharts';

const toISO = (d) => d.toISOString().slice(0, 10);
const subDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-sm text-slate-500">{payload[0].value.toLocaleString('ko-KR')}{suffix}</div>
    </div>
  );
}

export function StatisticsPage() {
  const today = new Date();
  const [loading, setLoading] = useState(true);
  const [purchaseTrend, setPurchaseTrend] = useState([]);
  const [topIngredients, setTopIngredients] = useState([]);
  const [topMenus, setTopMenus] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [recharts, setRecharts] = useState(null);

  // #9: 기간 설정
  const [fromDate, setFromDate] = useState(toISO(subDays(today, 30)));
  const [toDate, setToDate] = useState(toISO(today));
  const [periodData, setPeriodData] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [showPeriodSection, setShowPeriodSection] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [trendRes, ingRes, menuRes, kpisRes, rc] = await Promise.all([
          api.get('/statistics/purchase-trend'),
          api.get('/statistics/top-ingredients'),
          api.get('/statistics/top-menus'),
          api.get('/statistics/kpis'),
          loadRechartsFromCdn(),
        ]);
        setPurchaseTrend(trendRes.data);
        setTopIngredients(ingRes.data);
        setTopMenus(menuRes.data);
        setKpis(kpisRes.data);
        setRecharts(rc);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // #9: 기간별 데이터 조회
  const loadPeriod = async () => {
    setPeriodLoading(true);
    try {
      const res = await api.get('/statistics/period', { params: { from: fromDate, to: toDate } });
      setPeriodData(res.data);
      setShowPeriodSection(true);
    } finally { setPeriodLoading(false); }
  };

  // #12: Excel 다운로드 (데이터 필터 포함)
  const downloadExcel = () => {
    if (!periodData) return;
    const wb = XLSX.utils.book_new();

    const addSheetWithFilter = (rows, sheetName) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      // 데이터 필터 적용
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + cols.length)}${rows.length + 1}` };
        // 컬럼 너비 자동 조정
        ws['!cols'] = cols.map(() => ({ wch: 16 }));
      }
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheetWithFilter(periodData.diaries.map(d => ({
      날짜: d.date?.slice(0,10)||'', 식사시점: d.mealType||'', 식사시간: d.mealTime||'',
      메뉴명: d.recipeName||'', 칼로리: d.calories||0
    })), '식단일기');

    addSheetWithFilter(periodData.purchases.map(p => ({
      날짜: new Date(p.date).toISOString().slice(0,10),
      식재료명: p.itemName||'', 가격: p.price||0, 용량_g: p.grams||0, 구매처: p.source||'', 용도: p.purpose||''
    })), '지출내역');

    addSheetWithFilter(periodData.dailySpend.map(s => ({
      날짜: s.date, 지출금액: s.amount
    })), '일별지출흐름');

    const summaryWs = XLSX.utils.json_to_sheet([
      { 항목: '기간', 값: `${fromDate} ~ ${toDate}` },
      { 항목: '총 지출', 값: `${periodData.summary.totalSpend.toLocaleString()}원` },
      { 항목: '총 칼로리', 값: `${periodData.summary.totalCalories} kcal` },
      { 항목: '구매 건수', 값: `${periodData.summary.purchaseCount}건` },
      { 항목: '식단 기록 수', 값: `${periodData.summary.diaryCount}개` }
    ]);
    XLSX.utils.book_append_sheet(wb, summaryWs, '요약');

    XLSX.writeFile(wb, `FreshTable_${fromDate}_${toDate}.xlsx`);
  };

  // #12: Google Sheets - 탭 구분 데이터를 클립보드에 복사 후 Sheets 열기
  const [sheetsMsg, setSheetsMsg] = useState('');
  const openGoogleSheets = async () => {
    if (!periodData) return;
    // 헤더 + 데이터를 탭 구분(TSV)으로 생성
    const tsvLines = [
      '=== 식단일기 ===',
      '날짜	식사시점	식사시간	메뉴명	칼로리',
      ...periodData.diaries.map(d => `${d.date?.slice(0,10)||''}	${d.mealType||''}	${d.mealTime||''}	${d.recipeName||''}	${d.calories||0}`),
      '',
      '=== 지출내역 ===',
      '날짜	식재료명	가격	용량(g)	구매처	용도',
      ...periodData.purchases.map(p => `${new Date(p.date).toISOString().slice(0,10)}	${p.itemName||''}	${p.price||0}	${p.grams||0}	${p.source||''}	${p.purpose||''}`),
      '',
      '=== 일별 지출 흐름 ===',
      '날짜	지출금액',
      ...periodData.dailySpend.map(s => `${s.date}	${s.amount}`)
    ].join('\n');

    try {
      await navigator.clipboard.writeText(tsvLines);
      setSheetsMsg('📋 데이터가 클립보드에 복사되었습니다! Google Sheets에서 셀 선택 후 Ctrl+V로 붙여넣기 하세요.');
    } catch {
      // fallback: textarea
      const el = document.createElement('textarea');
      el.value = tsvLines; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setSheetsMsg('📋 데이터가 복사되었습니다! Google Sheets에서 Ctrl+V로 붙여넣기 하세요.');
    }
    setTimeout(() => { window.open('https://sheets.new', '_blank'); }, 300);
    setTimeout(() => setSheetsMsg(''), 8000);
  };

  const trendChart = useMemo(() => {
    if (!recharts || purchaseTrend.length === 0) return null;
    const { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } = recharts;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={purchaseTrend}>
          <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false}/>
          <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v=>`${v/1000}k`}/>
          <Tooltip content={<ChartTooltip suffix="원"/>} cursor={{ fill:'#F1F5F9', radius:12 }}/>
          <Bar dataKey="amount" fill="#7FB069" radius={[10,10,0,0]} maxBarSize={45}/>
        </BarChart>
      </ResponsiveContainer>
    );
  }, [recharts, purchaseTrend]);

  const periodChart = useMemo(() => {
    if (!recharts || !periodData?.dailySpend?.length) return null;
    const { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } = recharts;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={periodData.dailySpend}>
          <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false}/>
          <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v=>`${v/1000}k`}/>
          <Tooltip content={<ChartTooltip suffix="원"/>} cursor={{ fill:'#F1F5F9', radius:8 }}/>
          <Bar dataKey="amount" fill="#A8CE95" radius={[8,8,0,0]} maxBarSize={30}/>
        </BarChart>
      </ResponsiveContainer>
    );
  }, [recharts, periodData]);

  if (loading) return <div className="p-8 text-center text-slate-400">통계 차트를 렌더링하는 중입니다...</div>;

  return (
    <div>
      <PageHeader title="식습관 및 소비 다차원 통계" subtitle="기간별 식단일기, 지출내역 데이터를 Excel로 다운로드하거나 Google Sheets로 내보낼 수 있습니다."/>

      {/* #9: 기간 설정 + 내보내기 */}
      <div className="mb-6 soft-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">시작일</label>
            <input type="date" className="input-base" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">종료일</label>
            <input type="date" className="input-base" value={toDate} onChange={e=>setToDate(e.target.value)}/>
          </div>
          <button onClick={loadPeriod} disabled={periodLoading} className="rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60">
            {periodLoading?'조회 중...':'기간 조회'}
          </button>
          {periodData && (
            <>
              <button onClick={downloadExcel} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">
                <Download size={16}/> Excel 다운로드
              </button>
              <button onClick={openGoogleSheets} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
                <FileSpreadsheet size={16}/> Google Sheets 열기
              </button>
            </>
          )}
        </div>
        {sheetsMsg && (
          <div className="mt-3 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-medium text-blue-800">{sheetsMsg}</div>
        )}
        {periodData && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-2xl bg-[#F4F8F1] p-3 text-center"><div className="font-extrabold text-sage text-lg">{periodData.summary.totalSpend.toLocaleString()}원</div><div className="text-xs text-slate-400 mt-1">총 지출</div></div>
            <div className="rounded-2xl bg-[#F4F8F1] p-3 text-center"><div className="font-extrabold text-sage text-lg">{periodData.summary.totalCalories} kcal</div><div className="text-xs text-slate-400 mt-1">총 칼로리</div></div>
            <div className="rounded-2xl bg-[#F4F8F1] p-3 text-center"><div className="font-extrabold text-slate-700 text-lg">{periodData.summary.purchaseCount}건</div><div className="text-xs text-slate-400 mt-1">구매 건수</div></div>
            <div className="rounded-2xl bg-[#F4F8F1] p-3 text-center"><div className="font-extrabold text-slate-700 text-lg">{periodData.summary.diaryCount}개</div><div className="text-xs text-slate-400 mt-1">식단 기록</div></div>
          </div>
        )}
      </div>

      {/* 기간별 지출 흐름 차트 */}
      {showPeriodSection && periodData && (
        <div className="mb-6 soft-card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">📊 기간별 일일 지출 흐름 ({fromDate} ~ {toDate})</h2>
          <div className="h-56 w-full">{periodChart||<div className="text-center text-slate-400 pt-16">지출 데이터가 없습니다.</div>}</div>
        </div>
      )}

      {kpis && (
        <div className="mb-6 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          <StatCard title="이번 달 총 지출" value={formatCurrency(kpis.monthlyTotal)}/>
          <StatCard title="일평균 소비 식재료" value={`${kpis.dailyAverageGrams} g`}/>
          <StatCard title="가장 큰 지출 항목" value={kpis.topSource||'없음'}/>
          <StatCard title="기록된 총 식단 일수" value={`${kpis.totalDiaryDays} 일`}/>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="soft-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage"><TrendingUp size={20}/></div>
            <div><h2 className="text-xl font-bold text-slate-900">최근 7일간 지출 흐름</h2><p className="text-sm text-slate-500">일자별 식자재 구매 통계입니다.</p></div>
          </div>
          <div className="h-72 w-full mt-6">{trendChart||<div className="text-center text-slate-400 pt-16">차트 데이터가 없습니다.</div>}</div>
        </section>
        <section className="soft-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage"><BarChart3 size={20}/></div>
            <div><h2 className="text-xl font-bold text-slate-900">가장 많이 쓴 식재료 TOP 5</h2><p className="text-sm text-slate-500">중량(g) 누적 차감 기준</p></div>
          </div>
          <div className="space-y-4">
            {topIngredients.map((item,i)=>(
              <div key={item.name} className="flex items-center justify-between gap-4 rounded-[24px] border border-border bg-[#FCFCFC] p-4">
                <div><span className="text-xs font-bold text-slate-400">RANK 0{i+1}</span><div className="mt-1 font-bold text-slate-900">{item.name}</div></div>
                <div className="text-right"><div className="text-lg font-extrabold text-sage">{item.totalGrams} g</div><div className="text-xs text-slate-400">총 {item.count}회</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        <section className="soft-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage"><ChefHat size={20}/></div>
            <div><h2 className="text-xl font-bold text-slate-900">자주 먹는 메뉴 TOP 5</h2><p className="text-sm text-slate-500">식단 기록에서 반복된 메뉴예요.</p></div>
          </div>
          <div className="space-y-4">
            {topMenus.map((menu,i)=>(
              <div key={menu.name} className="rounded-[24px] border border-border bg-[#FCFCFC] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div><div className="text-xs font-semibold text-slate-400">TOP {i+1}</div><div className="mt-1 text-lg font-bold text-slate-900">{menu.name}</div></div>
                  <div className="text-right"><div className="text-lg font-extrabold text-sage">{menu.count}회</div><div className="text-xs text-slate-400">누적 {menu.totalGrams}g</div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
