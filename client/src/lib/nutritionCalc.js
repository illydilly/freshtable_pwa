import { api } from './api';

/**
 * Step1 DB → Step2 공공API 순서로 영양정보 계산
 * @param {Array<{name:string, grams:number}>} ingredients
 * @returns {Promise<{total, perIngredient, missingCount, missingIngredients}>}
 */
export async function calculateNutrition(ingredients) {
  const valid = ingredients.filter(i => i.name?.trim() && Number(i.grams) > 0);
  if (!valid.length) return null;
  const res = await api.post('/nutrition/calculate', { ingredients: valid });
  return res.data;
}

/**
 * Step3 Claude AI로 미확인 재료 영양 추정
 * @param {Array<{name:string, grams:number}>} ingredients - 미확인 재료 목록
 * @returns {Promise<{calories, carbs, protein, fat, sodium, sugar, source, estimated}>}
 */
export async function estimateWithAI(ingredients) {
  const res = await api.post('/nutrition/estimate-ai', { ingredients });
  return res.data;
}
