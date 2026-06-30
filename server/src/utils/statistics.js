// server/src/utils/statistics.js

/**
 * ════════════════════════════════════════════════════════════════════
 * 타임존 안전 설계 원칙
 * ════════════════════════════════════════════════════════════════════
 * Railway 등 클라우드 서버는 process.env.TZ 설정에 따라 동작이 달라질 수 있다.
 * date-fns의 format()/eachDayOfInterval() 등은 "서버의 로컬 타임존"을 기준으로
 * 동작하므로, 서버 TZ 설정과 무관하게 항상 동일한 결과를 보장하려면
 * Date.getTime()과 Date.toISOString()만 사용해야 한다.
 * (toISOString()은 항상 UTC를 반환하는 것이 JS 명세로 보장되어 있음)
 *
 * 따라서 이 파일의 모든 "날짜 그룹화/라벨링" 로직은 date-fns의 로컬타임
 * 함수를 사용하지 않고, getTime() 기반 순수 계산만 사용한다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 임의 시점(Date|string) → KST 기준 'yyyy-MM-dd' (서버 TZ와 무관, 항상 정확) */
function kstDateKey(date) {
  const shifted = new Date(new Date(date).getTime() + KST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** 임의 시점 → KST 기준 'yyyy-MM' */
function kstMonthKey(date) {
  return kstDateKey(date).slice(0, 7);
}

/**
 * 'yyyy-MM-dd' 형태의 KST 달력 날짜 문자열(from, to)을 받아
 * 해당 KST 하루 전체를 포함하는 UTC 범위 [gte, lte] 를 반환.
 * 예: from='2026-06-25' → KST 06-25 00:00:00 ~ 23:59:59.999 를 UTC로 정확히 환산.
 * (new Date('2026-06-25') 단순 파싱은 UTC 자정 = KST 오전9시로 해석되어
 *  그날 0~9시 데이터가 누락되는 버그가 있었음 — 이를 방지)
 */
function kstRangeToUTC(fromInput, toInput) {
  const fromKeyStr = fromInput ? kstDateKey(fromInput) : kstDateKey(new Date(Date.now() - 30 * DAY_MS));
  const toKeyStr   = toInput   ? kstDateKey(toInput)   : kstDateKey(new Date());

  // KST 00:00:00 = UTC (그날 00:00 - 9h)
  const fromUTC = new Date(Date.parse(`${fromKeyStr}T00:00:00.000Z`) - KST_OFFSET_MS);
  // KST 23:59:59.999 = UTC (다음날 00:00 - 9h - 1ms)
  const toUTC   = new Date(Date.parse(`${toKeyStr}T00:00:00.000Z`) - KST_OFFSET_MS + DAY_MS - 1);

  return { fromUTC, toUTC, fromKeyStr, toKeyStr };
}

/** 임의 시점 → 차트 라벨용 'M/d' (예: '6/29') */
function kstShortLabel(date) {
  const [, m, d] = kstDateKey(date).split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 임의 시점 → 차트 라벨용 'M월' */
function kstMonthLabel(date) {
  const [, m] = kstMonthKey(date).split('-');
  return `${Number(m)}월`;
}

/**
 * Zero-filling: from~to 사이 모든 KST 날짜를 빠짐없이 { date, amount } 로 채움.
 * eachDayOfInterval(date-fns) 대신 getTime() 기반 순수 루프 사용 → 서버 TZ 영향 없음.
 */
function zeroFillDates(rows, from, to) {
  const map = new Map(rows.map((r) => [r.date, r.amount]));

  // from, to 를 KST 자정 기준으로 정규화 후 1일씩 순회
  const fromKeyMs = Date.parse(`${kstDateKey(from)}T00:00:00.000Z`);
  const toKeyMs   = Date.parse(`${kstDateKey(to)}T00:00:00.000Z`);

  const result = [];
  for (let t = fromKeyMs; t <= toKeyMs; t += DAY_MS) {
    const dateStr = new Date(t).toISOString().slice(0, 10);
    result.push({ date: dateStr, amount: map.get(dateStr) ?? 0 });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 월별 구매 추이 (최근 6개월) — { date:'6월', amount:12345 } 형태로 반환
// ═══════════════════════════════════════════════════════════════════
export async function buildPurchaseTrend(prisma, now = new Date()) {
  // 최근 6개월(이번 달 포함) 의 KST 기준 month key 목록을 직접 생성
  const months = [];
  const base = new Date(kstMonthKey(now) + '-01T00:00:00.000Z');
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d);
  }

  const rangeStart = new Date(months[0]);
  const rangeEnd   = new Date(now);

  const purchases = await prisma.purchase.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
  });

  return months.map((monthDate) => {
    const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const total = purchases
      .filter((p) => kstMonthKey(p.date) === key)
      .reduce((sum, p) => sum + p.price, 0);
    const label = `${monthDate.getUTCMonth() + 1}월`;
    return { month: label, date: label, total, amount: total };
  });
}

// ═══════════════════════════════════════════════════════════════════
// 최근 N일 일별 지출 (KST + Zero-fill) — { date:'6/29', amount:2495 }
// ═══════════════════════════════════════════════════════════════════
export async function buildDailyTrend(prisma, now = new Date(), days = 7) {
  const todayKey  = kstDateKey(now);
  const todayMs   = Date.parse(`${todayKey}T00:00:00.000Z`);
  const fromMs    = todayMs - (days - 1) * DAY_MS;

  // DB 조회 범위: KST 자정을 UTC로 환산해서 gte/lte 설정
  const fromUTC = new Date(fromMs - KST_OFFSET_MS);
  const toUTC   = new Date(todayMs + DAY_MS - KST_OFFSET_MS); // 오늘 KST 23:59:59.999 까지

  const purchases = await prisma.purchase.findMany({
    where: { date: { gte: fromUTC, lte: toUTC } },
  });

  const dailyMap = {};
  purchases.forEach((p) => {
    const key = kstDateKey(p.date);
    dailyMap[key] = (dailyMap[key] || 0) + p.price;
  });

  const result = [];
  for (let t = fromMs; t <= todayMs; t += DAY_MS) {
    const dateStr = new Date(t).toISOString().slice(0, 10);
    const [, m, d] = dateStr.split('-');
    result.push({
      date: `${Number(m)}/${Number(d)}`, // 차트 표시용 라벨
      dateKey: dateStr,
      amount: dailyMap[dateStr] || 0,
    });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// TOP 식재료 — 개수 단위 재료도 올바르게 집계
// ═══════════════════════════════════════════════════════════════════
export async function buildTopIngredients(prisma) {
  const usageRows = await prisma.usageHistory.findMany({
    include: { ingredient: { include: { purchase: true } } },
  });

  const grouped = usageRows.reduce((acc, row) => {
    const name     = row.ingredient?.name || '기타';
    const unitType = row.ingredient?.purchase?.unitType || 'g';
    const unitAmt  = Number(row.ingredient?.purchase?.unitAmount) || 0;
    const rawUsed  = row.gramsUsed ?? 0;

    const effectiveGrams =
      (unitType === 'count' || unitType === '개수') && unitAmt > 0
        ? rawUsed * unitAmt
        : rawUsed;

    if (!acc[name]) acc[name] = { name, totalGrams: 0, usageCount: 0, count: 0, unitType };
    acc[name].totalGrams += effectiveGrams;
    acc[name].usageCount += 1;
    acc[name].count      += 1;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.totalGrams - a.totalGrams || b.count - a.count)
    .slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════
// 자주 먹는 메뉴 TOP 5
// ═══════════════════════════════════════════════════════════════════
export async function buildTopMenus(prisma) {
  const usageRows = await prisma.usageHistory.findMany({ orderBy: { date: 'desc' } });

  const grouped = usageRows.reduce((acc, row) => {
    if (!acc[row.menuName]) acc[row.menuName] = { name: row.menuName, count: 0, totalGrams: 0 };
    acc[row.menuName].count      += 1;
    acc[row.menuName].totalGrams += row.gramsUsed ?? 0;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.count - a.count || b.totalGrams - a.totalGrams)
    .slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════
// 이번 달 KPI 요약
// ═══════════════════════════════════════════════════════════════════
export async function buildMonthlyKpis(prisma, now = new Date()) {
  const monthKey   = kstMonthKey(now);
  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const monthEndMs = new Date(monthStart);
  monthEndMs.setUTCMonth(monthEndMs.getUTCMonth() + 1);
  const monthEnd   = new Date(monthEndMs.getTime() - 1);

  const [purchases, usageRows, diaries, urgentCount, shoppingOpenCount] = await Promise.all([
    prisma.purchase.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    prisma.usageHistory.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    prisma.mealDiary.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      include: { recipe: true },
    }),
    prisma.ingredient.count({
      where: { purchase: { date: { lte: new Date(now.getTime() - 14 * DAY_MS) } } },
    }),
    prisma.shoppingList.count({ where: { checked: false } }),
  ]);

  const menuFrequency = diaries.reduce((acc, e) => {
    const name = e.recipe?.name || `${e.mealType} 기록`;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const sourceTotals = purchases.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + p.price;
    return acc;
  }, {});

  const topMenu         = Object.entries(menuFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '아직 기록 없음';
  const topSource       = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const uniqueDiaryDays = new Set(diaries.map((e) => kstDateKey(e.date))).size;
  const elapsedDays     = Math.max(Number(kstDateKey(now).slice(8, 10)), 1);
  const purchaseTotal   = purchases.reduce((s, p) => s + p.price, 0);
  const consumedGrams   = usageRows.reduce((s, r) => s + (r.gramsUsed ?? 0), 0);

  return {
    purchaseTotal,
    monthlyTotal: purchaseTotal,
    purchaseCount: purchases.length,
    consumedGrams,
    dailyAverageGrams: Math.round(consumedGrams / elapsedDays),
    diaryCompletionRate: Math.round((uniqueDiaryDays / elapsedDays) * 100),
    totalDiaryDays: uniqueDiaryDays,
    urgentIngredientCount: urgentCount,
    openShoppingCount: shoppingOpenCount,
    topMenu,
    topSource,
  };
}

export { zeroFillDates, kstDateKey, kstMonthKey, kstShortLabel, kstMonthLabel, kstRangeToUTC };
