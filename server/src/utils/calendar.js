import { eachWeekOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';

export async function buildWeeklyPurchaseTotals(prisma, baseDate) {
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const weekStarts = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

  const purchases = await prisma.purchase.findMany({
    where: { date: { gte: startOfWeek(monthStart, { weekStartsOn: 1 }), lte: endOfWeek(monthEnd, { weekStartsOn: 1 }) } }
  });

  return weekStarts.map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const total = purchases
      .filter((purchase) => purchase.date >= weekStart && purchase.date <= weekEnd)
      .reduce((sum, purchase) => sum + purchase.price, 0);

    return {
      label: `${index + 1}주차`,
      total,
      range: `${format(weekStart, 'M.d')} - ${format(weekEnd, 'M.d')}`
    };
  });
}
