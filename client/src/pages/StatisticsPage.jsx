import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChefHat, Download, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'; // #핵심수정: CDN 비동기 로딩(loadRechartsFromCdn) 대신 npm 패키지 정적 import
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/utils';

const toISO = (d) => d.toISOString().slice(0, 10);
const subDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() - n); return r; };

/* ── 툴팁 ───────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-sm text-slate-500">
        {payload[0].value.toLocaleString('ko-KR')}{suffix}
      </div>
    </div>
  );
}

/* ── 빈 차트 플레이스홀더 ──────────────────────────────────────── */
function EmptyChart({ message = '데이터가 없습니다.' }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-slate-400">
      {message}
    </div>
  );
}

/* ── TOP 식재료 단위 표기 ──────────────────────────────────────── */
function formatIngredientStat(item) {
  const ut = item.unitType || 'g';
  if (ut === 'count' || ut === '개수') return `누적 ${item.count}회 사용`;
  if (ut === 'ml') return `${item.totalGrams.toLocaleString('ko-KR')}ml`;
  if (ut === 'kg') {
    const kg = (item.totalGrams / 1000).toFixed(1);
    return `${kg}kg`;
  }
  return `${item.totalGrams.toLocaleString('ko-KR')}g`;
}

export function StatisticsPage() {
  const today = new Date();

  /* ── 상태 ─────────────────────────────────────────────────────── */
  const [loading,        setLoading]        = useState(true);
  const [purchaseTrend,  setPurchaseTrend]  = useState([]);  // 월별 추이
  const [dailyTrend,     setDailyTrend]     = useState([]);  // 최근 7일 일별
  const [topIngredients, setTopIngredients] = useState([]);
  const [topMenus,       setTopMenus]       = useState([]);
  const [kpis,           setKpis]           = useState(null);

  // 기간 조회
  const [periodFrom,  setPeriodFrom]  = useState(toISO(subDays(today, 29)));
  const [periodTo,    setPeriodTo]    = useState(toISO(today));
  const [periodData,  setPeriodData]  = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  /* ── 초기 데이터 로드 ──────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      api.get('/statistics/purchase-trend'),
      api.get('/statistics/daily-trend?days=7'),
      api.get('/statistics/top-ingredients'),
      api.get('/statistics/top-menus'),
      api.get('/statistics/kpis'),
      // #핵심수정: recharts는 더 이상 비동기 CDN 로딩이 필요 없음 (정적 import 완료)
    ])
      .then(([trend, daily, ingr, menus, kpisRes]) => {
        // #1: 백엔드가 이미 {date, amount} 형태로 내려주지만, 혹시 모를 키 불일치를
        // 방어적으로 한 번 더 매핑해서 차트가 절대 깨지지 않도록 보강
        setPurchaseTrend((trend.data  || []).map(d => ({ date: d.date ?? d.month, amount: Number(d.amount ?? d.total ?? 0) })));
        setDailyTrend((daily.data     || []).map(d => ({ date: d.date, amount: Number(d.amount ?? 0) })));
        setTopIngredients(ingr.data   || []);
        setTopMenus(menus.data        || []);
        setKpis(kpisRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ── 기간별 조회 ────────────────────────────────────────────────── */
  const searchPeriod = async () => {
    setPeriodLoading(true);
    try {
      const res = await api.get('/statistics/period', { params: { from: periodFrom, to: periodTo } });
      // #1: dailySpend 키 구조를 차트가 기대하는 {date, amount} 형태로 방어적 재매핑
      const normalized = {
        ...res.data,
        dailySpend: (res.data.dailySpend || []).map(d => ({
          date: d.date,
          amount: Number(d.amount ?? d._sum?.price ?? 0),
        })),
      };
      setPeriodData(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      setPeriodLoading(false);
    }
  };

  /* ── Recharts 차트 렌더 헬퍼 ────────────────────────────────────── */
  const renderBarChart = (data, xKey, yKey, color = '#7FB069', suffix = '원', height = 200) => {
    // #핵심수정: recharts가 정적 import 되어 항상 사용 가능 → CDN 로딩 대기/실패로 인한
    // "데이터가 없습니다" 오표시가 더 이상 발생하지 않음. 데이터 유무만 체크.
    if (!data?.length) return <EmptyChart />;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} />
          <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  /* ── 엑셀 내보내기 ─────────────────────────────────────────────── */
  const exportExcel = () => {
    if (!periodData) return;
    const wb = XLSX.utils.book_new();
    if (periodData.dailySpend?.length) {
      const ws = XLSX.utils.json_to_sheet(
        periodData.dailySpend.map((d) => ({ 날짜: d.date, 지출: d.amount }))
      );
      XLSX.utils.book_append_sheet(wb, ws, '일별지출');
    }
    if (periodData.purchases?.length) {
      const ws2 = XLSX.utils.json_to_sheet(
        periodData.purchases.map((p) => ({
          날짜: new Date(p.date).toLocaleDateString('ko-KR'),
          품목: p.itemName, 가격: p.price, 용량: p.grams, 구매처: p.source,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws2, '구매내역');
    }
    XLSX.writeFile(wb, `FreshTable_통계_${periodFrom}_${periodTo}.xlsx`);
  };

  /* ── 기간 총계 ──────────────────────────────────────────────────── */
  const periodTotal = useMemo(() =>
    periodData?.dailySpend?.reduce((s, d) => s + (d.amount || 0), 0) ?? 0,
    [periodData]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        통계를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="통계"
        subtitle="지출 흐름, 식재료 소비, 식단 패턴을 한눈에 파악하세요."
      />

      {/* ── KPI 요약 카드 ─────────────────────────────────────── */}
      {kpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="이달 총 지출"       value={formatCurrency(kpis.monthlyTotal)}   />
          <StatCard label="이달 구매 횟수"     value={`${kpis.purchaseCount}회`}            />
          <StatCard label="일일 평균 소비량"   value={`${kpis.dailyAverageGrams}g`}         />
          <StatCard label="식단 기록률"        value={`${kpis.diaryCompletionRate}%`}       />
          <StatCard label="주 구매처"          value={kpis.topSource   || '-'}              />
          <StatCard label="즐겨 먹는 메뉴"     value={kpis.topMenu     || '-'}              />
          <StatCard label="긴급 식재료"        value={`${kpis.urgentIngredientCount}개`}    />
          <StatCard label="장보기 미완료"      value={`${kpis.openShoppingCount}개`}        />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── 최근 7일 일별 지출 흐름 ─────────────────────────────────
            ▸ /api/statistics/daily-trend (KST + Zero-fill 적용)
            ▸ dataKey: "date"(표시용 M/d), "amount"(지출액)         */}
        <section className="soft-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-sage" />
            <h2 className="text-lg font-bold text-slate-900">최근 7일간 지출 흐름</h2>
          </div>
          {dailyTrend.length > 0
            ? renderBarChart(dailyTrend, 'date', 'amount', '#7FB069', '원', 200)
            : <EmptyChart message="최근 7일 구매 데이터가 없습니다." />
          }
        </section>

        {/* ── 월별 구매 추이 ───────────────────────────────────────────
            ▸ /api/statistics/purchase-trend
            ▸ dataKey: "date"(M월 레이블), "amount"(월 합계)        */}
        <section className="soft-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-sage" />
            <h2 className="text-lg font-bold text-slate-900">월별 구매 추이 (6개월)</h2>
          </div>
          {purchaseTrend.length > 0
            ? renderBarChart(purchaseTrend, 'date', 'amount', '#A8D5BA', '원', 200)
            : <EmptyChart message="최근 6개월 데이터가 없습니다." />
          }
        </section>

        {/* ── TOP 5 식재료 ─────────────────────────────────────────── */}
        <section className="soft-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ChefHat size={18} className="text-sage" />
            <h2 className="text-lg font-bold text-slate-900">가장 많이 쓴 식재료 TOP 5</h2>
          </div>
          {topIngredients.length === 0 ? (
            <EmptyChart message="사용 내역이 없습니다." />
          ) : (
            <div className="space-y-3">
              {topIngredients.slice(0, 5).map((item, i) => {
                const maxGrams = topIngredients[0]?.totalGrams || 1;
                const pct = Math.min(Math.round((item.totalGrams / maxGrams) * 100), 100);
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">
                        <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                        {item.name}
                        {/* 개수 단위 배지 */}
                        {(item.unitType === 'count' || item.unitType === '개수') && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">개수</span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">{formatIngredientStat(item)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sage transition-all"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── TOP 5 메뉴 ──────────────────────────────────────────── */}
        <section className="soft-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ChefHat size={18} className="text-sage" />
            <h2 className="text-lg font-bold text-slate-900">자주 먹은 메뉴 TOP 5</h2>
          </div>
          {topMenus.length === 0 ? (
            <EmptyChart message="사용 내역이 없습니다." />
          ) : (
            <div className="space-y-3">
              {topMenus.slice(0, 5).map((item, i) => {
                const maxCount = topMenus[0]?.count || 1;
                const pct = Math.min(Math.round((item.count / maxCount) * 100), 100);
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">
                        <span className="mr-2 text-xs text-slate-400">{i + 1}</span>{item.name}
                      </span>
                      <span className="text-xs text-slate-500">{item.count}회</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#A8D5BA] transition-all"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── 기간별 일일 지출 흐름 ────────────────────────────────────
          ▸ /api/statistics/period (KST 그룹화 + Zero-fill 적용)
          ▸ dailySpend dataKey: "date"(yyyy-MM-dd), "amount"(일 합계) */}
      <section className="soft-card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-sage" />
            <h2 className="text-lg font-bold text-slate-900">기간별 일일 지출 흐름</h2>
          </div>
          {periodData && (
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 rounded-2xl bg-[#EDF7E7] px-4 py-2 text-sm font-semibold text-sage hover:bg-sage hover:text-white transition-colors"
            >
              <Download size={15} /> 엑셀 내보내기
            </button>
          )}
        </div>

        {/* 날짜 범위 선택 */}
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">시작일</label>
            <input type="date" className="input-base" value={periodFrom}
              max={periodTo}
              onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">종료일</label>
            <input type="date" className="input-base" value={periodTo}
              max={toISO(today)}
              onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <button
            onClick={searchPeriod}
            disabled={periodLoading}
            className="rounded-2xl bg-sage px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {periodLoading ? '조회 중...' : '기간 조회'}
          </button>
          {/* 빠른 선택 버튼 */}
          {[
            { label: '최근 7일',  days: 7  },
            { label: '최근 30일', days: 30 },
            { label: '최근 60일', days: 60 },
          ].map(({ label, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setPeriodFrom(toISO(subDays(today, days - 1)));
                setPeriodTo(toISO(today));
              }}
              className="rounded-2xl border border-border bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:border-sage hover:text-sage transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {!periodData && (
          <div className="rounded-2xl bg-[#FCFCFC] py-10 text-center text-sm text-slate-400">
            날짜 범위를 선택하고 [기간 조회]를 눌러주세요.
          </div>
        )}

        {periodData && (
          <>
            {/* 기간 요약 */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#F4F8F1] p-4">
                <div className="text-xs text-slate-500">기간 총 지출</div>
                <div className="mt-1 text-xl font-extrabold text-sage">{formatCurrency(periodTotal)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">구매 건수</div>
                <div className="mt-1 text-xl font-extrabold text-slate-800">{periodData.purchases?.length ?? 0}건</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">일 평균 지출</div>
                <div className="mt-1 text-xl font-extrabold text-slate-800">
                  {formatCurrency(Math.round(periodTotal / Math.max(periodData.dailySpend?.length || 1, 1)))}
                </div>
              </div>
            </div>

            {/* 일별 지출 차트
                ▸ Zero-fill 된 데이터: 빈 날짜도 amount=0 으로 존재
                ▸ xKey="date"(yyyy-MM-dd), yKey="amount" */}
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">일별 지출 추이</div>
              {periodData.dailySpend?.length > 0
                ? renderBarChart(periodData.dailySpend, 'date', 'amount', '#7FB069', '원', 220)
                : <EmptyChart message="해당 기간에 구매 내역이 없습니다." />
              }
            </div>

            {/* 구매 내역 테이블 */}
            {periodData.purchases?.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  구매 내역 ({periodData.purchases.length}건)
                </div>
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-[#FCFCFC]">
                      <tr>
                        {['날짜', '품목', '가격', '구매처'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {periodData.purchases.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(p.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{p.itemName}</td>
                          <td className="px-4 py-3 font-semibold text-sage">{formatCurrency(p.price)}</td>
                          <td className="px-4 py-3 text-slate-500">{p.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
