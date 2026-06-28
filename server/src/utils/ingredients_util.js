// server/src/utils/ingredients.js

export function freshnessStatus(purchaseDate) {
  const elapsed = Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
  if (elapsed < 7)  return '신선';
  if (elapsed < 14) return '빨리 먹기';
  return '긴급';
}

export function expiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(expiryDate); expiry.setHours(0,0,0,0);
  const daysUntil = Math.round((expiry - today) / (24*60*60*1000));
  if (daysUntil <  0) return { label:'폐기필수',   color:'expired', daysUntil };
  if (daysUntil === 0) return { label:'오늘 만료', color:'danger',  daysUntil };
  if (daysUntil === 1) return { label:'내일 만료', color:'warning', daysUntil };
  return { label:`${daysUntil}일 남음`, color:'safe', daysUntil };
}

/**
 * #2 Fix: purchase.grams 를 totalGrams 의 SSoT(Single Source of Truth)로 사용.
 * 구매 수정 등으로 purchase.grams 가 바뀌어도 ingredient.totalGrams 가 stale 할 수 있으므로
 * 항상 purchase.grams 를 우선 사용하고, 없을 때만 ingredient.totalGrams 로 fallback.
 */
export function normalizeIngredient(ingredient) {
  const effectiveTotal = ingredient.purchase?.grams ?? ingredient.totalGrams ?? 0;
  const remainingGrams = Math.max(effectiveTotal - (ingredient.usedGrams ?? 0), 0);
  const percentRemaining = effectiveTotal > 0
    ? Math.round((remainingGrams / effectiveTotal) * 100)
    : 0;

  // #3: unitType 이 없으면 'g' 기본값
  const unitType = ingredient.purchase?.unitType ?? 'g';

  return {
    ...ingredient,
    totalGrams:       effectiveTotal,   // 항상 purchase.grams 기준으로 override
    remainingGrams,
    percentRemaining,
    unitType,                           // 단위를 최상위로 노출
    isAlertEnabled:   ingredient.isAlertEnabled ?? false,
    status:           freshnessStatus(ingredient.purchase?.date ?? ingredient.createdAt),
    expiryInfo:       expiryStatus(ingredient.expiryDate),
  };
}
