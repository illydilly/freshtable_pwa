import { normalizeIngredient } from './ingredients.js';

export async function buildRecipeRecommendations(prisma, threshold = 60) {
  const [ingredients, recipes] = await Promise.all([
    prisma.ingredient.findMany({ include: { purchase: true } }),
    prisma.recipe.findMany({ orderBy: { satisfaction: 'desc' } })
  ]);

  const ownedIngredients = ingredients
    .map(normalizeIngredient)
    .filter((item) => item.remainingGrams > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      remainingGrams: item.remainingGrams,
      status: item.status
    }));

  const inventoryMap = new Map(ownedIngredients.map((item) => [item.name, item.remainingGrams]));

  const recommendations = recipes
    .map((recipe) => {
      const recipeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const matchedIngredients = [];
      const missingIngredients = [];

      recipeIngredients.forEach((ingredient) => {
        const remaining = inventoryMap.get(ingredient.name) || 0;
        if (remaining >= Number(ingredient.grams || 0)) {
          matchedIngredients.push({
            name: ingredient.name,
            neededGrams: Number(ingredient.grams || 0),
            remainingGrams: remaining
          });
        } else {
          missingIngredients.push({
            name: ingredient.name,
            neededGrams: Number(ingredient.grams || 0),
            remainingGrams: remaining,
            shortfallGrams: Math.max(Number(ingredient.grams || 0) - remaining, 0)
          });
        }
      });

      const matchRate = recipeIngredients.length
        ? Math.round((matchedIngredients.length / recipeIngredients.length) * 100)
        : 0;

      return {
        id: recipe.id,
        name: recipe.name,
        satisfaction: recipe.satisfaction,
        cookingTime: recipe.cookingTime,
        calories: recipe.calories,
        matchRate,
        matchedIngredients,
        missingIngredients,
        qualifies: matchRate >= threshold
      };
    })
    .filter((recipe) => recipe.qualifies)
    .sort((a, b) => (b.matchRate - a.matchRate) || (b.satisfaction - a.satisfaction));

  return {
    threshold,
    ownedIngredients,
    recommendations
  };
}
