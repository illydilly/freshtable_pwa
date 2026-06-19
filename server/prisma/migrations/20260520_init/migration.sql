-- AlterTable: Add expiryDate and storageNote to Ingredient
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "storageNote" TEXT;

-- AlterTable: Add cookingTools to Recipe and mealTime to MealDiary
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "cookingTools" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "MealDiary" ADD COLUMN IF NOT EXISTS "mealTime" TEXT;

-- Add purpose to Purchase and thumbnailUrl to Recipe
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Add mealType to UsageHistory and mealItems to MealDiary
ALTER TABLE "UsageHistory" ADD COLUMN IF NOT EXISTS "mealType" TEXT;
ALTER TABLE "MealDiary" ADD COLUMN IF NOT EXISTS "mealItems" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add category to Purchase and mealCategory/diningOutId to MealDiary
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'ingredient';
ALTER TABLE "MealDiary" ADD COLUMN IF NOT EXISTS "mealCategory" TEXT NOT NULL DEFAULT 'home-cooked';
ALTER TABLE "MealDiary" ADD COLUMN IF NOT EXISTS "diningOutId" INTEGER;
