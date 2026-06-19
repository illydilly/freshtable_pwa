import { endOfMonth, endOfWeek, format, formatISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export async function buildDashboard(prisma, now = new Date()) {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(now,   { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd   = new Date(todayStart.getTime() + 86400000 - 1);

  const [
    weeklyPurchases,
    monthlyPurchases,
    ingredientsCount,
    recipesCount,
    shoppingListCount,
    todayDiaries,
    expiringIngredients,
    recentRecipes
  ] = await Promise.all([
    prisma.purchase.findMany({ where: { date: { gte: weekStart, lte: weekEnd } } }),
    prisma.purchase.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    prisma.ingredient.count({ where: { totalGrams: { gt: 0 } } }),
    prisma.recipe.count(),
    prisma.shoppingList.count({ where: { checked: false } }),
    prisma.mealDiary.findMany({ where: { date: { gte: todayStart, lte: todayEnd } }, include: { recipe: true } }),
    prisma.ingredient.findMany({
      include: { purchase: true },
      where: { totalGrams: { gt: 0 } },
      orderBy: { purchase: { date: 'asc' } },
      take: 5
    }),
    prisma.recipe.findMany({ orderBy: { createdAt: 'desc' }, take: 2 })
  ]);

  const today_calories = todayDiaries.reduce((sum, d) => sum + (d.recipe?.calories || 0), 0);

  // 유통기한 임박 식재료 (expiryDate 기반 우선, 없으면 구매 후 14일 기준)
  const expiring = expiringIngredients
    .map((ing) => {
      // #2: purchase.grams를 SSoT로 사용
      const totalGrams = ing.purchase?.grams ?? ing.totalGrams;
      const remainingGrams = Math.max(totalGrams - (ing.usedGrams ?? 0), 0);
      if (remainingGrams <= 0) return null; // #3: 소진된 재료는 제외

      let daysLeft = null;
      if (ing.expiryDate) {
        daysLeft = Math.round((new Date(ing.expiryDate) - now) / 86400000);
      } else {
        const elapsed = Math.round((now - new Date(ing.purchase.date)) / 86400000);
        daysLeft = 14 - elapsed;
      }
      return {
        id: ing.id,
        itemName: ing.name,
        grams: remainingGrams,
        daysLeft
      };
    })
    .filter((i) => i !== null && i.daysLeft !== null && i.daysLeft <= 3)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    // 대시보드 StatCard 필드 (올바른 키 이름)
    ingredients_count: ingredientsCount,
    recipes_count: recipesCount,
    today_calories,
    shopping_list_count: shoppingListCount,
    weekly_total: weeklyPurchases.reduce((s, p) => s + p.price, 0),
    monthly_total: monthlyPurchases.reduce((s, p) => s + p.price, 0),
    // 유통기한 임박
    expiring_ingredients: expiring,
    // 최근 레시피 - thumbnailUrl이 있을 때만 사용 (placeholder는 이름이 잘릴 수 있어서 제거)
    recent_recipes: recentRecipes.map((r) => ({
      id: r.id,
      name: r.name,
      satisfaction: r.satisfaction,
      thumbnailUrl: r.thumbnailUrl || null,
      thumbnail: null,
      calories: r.calories
    })),
    today: formatISO(now, { representation: 'date' })
  };
}
