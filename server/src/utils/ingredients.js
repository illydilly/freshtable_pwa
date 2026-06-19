export function freshnessStatus(purchaseDate, expiryDate) {
  if (expiryDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((expiry - today) / 86400000);
    if (daysUntil <= 0) return '긴급';
    if (daysUntil <= 3) return '빨리 먹기';
    return '신선';
  }
  const elapsed = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86400000);
  if (elapsed < 7) return '신선';
  if (elapsed < 14) return '빨리 먹기';
  return '긴급';
}

export function expiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((expiry - today) / 86400000);
  if (daysUntil < 0) return { label: '폐기필수', color: 'expired', daysUntil };
  if (daysUntil === 0) return { label: '오늘 만료', color: 'danger', daysUntil };
  if (daysUntil === 1) return { label: '내일 만료', color: 'warning', daysUntil };
  if (daysUntil <= 3) return { label: `${daysUntil}일 남음`, color: 'warning', daysUntil };
  return { label: `${daysUntil}일 남음`, color: 'safe', daysUntil };
}

export function normalizeIngredient(ingredient) {
  // #2 FIX: purchase.grams를 총 구매량의 단일 진실 공급원(SSoT)으로 사용
  // ingredient.totalGrams는 구매 편집 시 동기화가 늦어질 수 있으므로
  // purchase.grams를 직접 참조해 항상 최신값으로 계산
  const totalGrams = ingredient.purchase?.grams ?? ingredient.totalGrams;
  const usedGrams = ingredient.usedGrams ?? 0;
  const remainingGrams = Math.max(totalGrams - usedGrams, 0);
  const percentRemaining = totalGrams > 0 ? Math.round((remainingGrams / totalGrams) * 100) : 0;

  return {
    ...ingredient,
    totalGrams,      // purchase.grams 기준으로 덮어씀
    usedGrams,
    remainingGrams,
    percentRemaining,
    status: freshnessStatus(ingredient.purchase.date, ingredient.expiryDate),
    expiryInfo: expiryStatus(ingredient.expiryDate)
  };
}
