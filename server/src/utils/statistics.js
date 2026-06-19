import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths
} from 'date-fns';

export async function buildPurchaseTrend(prisma, now = new Date()) {
  const rangeStart = startOfMonth(subMonths(now, 5));
  const rangeEnd = endOfMonth(now);
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  const purchases = await prisma.purchase.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    orderBy: { date: 'asc' }
  });

  return months.map((month) => {
    const key = format(month, 'yyyy-MM');
    const total = purchases
      .filter((purchase) => format(purchase.date, 'yyyy-MM') === key)
      .reduce((sum, purchase) => sum + purchase.price, 0);
    const label = format(month, 'M월');

    return {
      month: label,
      date: label,
      total,
      amount: total
    };
  });
}

export async function buildTopIngredients(prisma) {
  const usageRows = await prisma.usageHistory.findMany({
    include: { ingredient: true }
  });

  const grouped = usageRows.reduce((acc, row) => {
    const name = row.ingredient?.name || '기타';
    if (!acc[name]) {
      acc[name] = { name, totalGrams: 0, usageCount: 0, count: 0 };
    }
    acc[name].totalGrams += row.gramsUsed;
    acc[name].usageCount += 1;
    acc[name].count += 1;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.totalGrams - a.totalGrams)
    .slice(0, 10);
}

export async function buildTopMenus(prisma) {
  const usageRows = await prisma.usageHistory.findMany({ orderBy: { date: 'desc' } });

  const grouped = usageRows.reduce((acc, row) => {
    if (!acc[row.menuName]) {
      acc[row.menuName] = { name: row.menuName, count: 0, totalGrams: 0 };
    }
    acc[row.menuName].count += 1;
    acc[row.menuName].totalGrams += row.gramsUsed;
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => (b.count - a.count) || (b.totalGrams - a.totalGrams))
    .slice(0, 5);
}

export async function buildMonthlyKpis(prisma, now = new Date()) {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [purchases, usageRows, diaries, urgentCount, shoppingOpenCount] = await Promise.all([
    prisma.purchase.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    prisma.usageHistory.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    prisma.mealDiary.findMany({ where: { date: { gte: monthStart, lte: monthEnd } }, include: { recipe: true } }),
    prisma.ingredient.count({
      where: {
        purchase: {
          date: { lte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }
        }
      }
    }),
    prisma.shoppingList.count({ where: { checked: false } })
  ]);

  const menuFrequency = diaries.reduce((acc, entry) => {
    const name = entry.recipe?.name || `${entry.mealType} 기록`;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const sourceTotals = purchases.reduce((acc, purchase) => {
    acc[purchase.source] = (acc[purchase.source] || 0) + purchase.price;
    return acc;
  }, {});

  const topMenu = Object.entries(menuFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '아직 기록 없음';
  const topSource = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const uniqueDiaryDays = new Set(diaries.map((entry) => format(entry.date, 'yyyy-MM-dd'))).size;
  const elapsedDays = Math.max(Number(format(now, 'd')), 1);
  const purchaseTotal = purchases.reduce((sum, item) => sum + item.price, 0);
  const consumedGrams = usageRows.reduce((sum, item) => sum + item.gramsUsed, 0);

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
    topSource
  };
}
