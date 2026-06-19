import { subDays } from 'date-fns';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.mealDiary.deleteMany();
  await prisma.usageHistory.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.nutritionInfo.deleteMany();
  await prisma.notificationPreference.deleteMany();

  const purchasesData = [
    ['양파', 800, 4200, 2, '컬리'],
    ['닭가슴살', 400, 8900, 4, '쿠팡'],
    ['두부', 300, 2800, 9, '어글리어스'],
    ['시금치', 200, 3500, 15, '어글리어스'],
    ['당근', 350, 2500, 8, '컬리'],
    ['감자', 800, 5600, 3, '홈플러스'],
    ['계란', 600, 7200, 1, '컬리'],
    ['대파', 150, 1900, 2, '동네마트'],
    ['마늘', 100, 2300, 2, '동네마트'],
    ['고추', 120, 1800, 10, '컬리']
  ];

  const purchases = [];
  for (const [itemName, grams, price, daysAgo, source] of purchasesData) {
    const purchase = await prisma.purchase.create({
      data: {
        itemName,
        grams,
        price,
        source,
        date: subDays(new Date(), daysAgo)
      }
    });
    purchases.push(purchase);
  }

  const ingredientMap = {};
  for (const purchase of purchases) {
    const ingredient = await prisma.ingredient.create({
      data: {
        name: purchase.itemName,
        purchaseId: purchase.id,
        totalGrams: purchase.grams,
        usedGrams: 0
      }
    });
    ingredientMap[ingredient.name] = ingredient;
  }

  const recipes = await Promise.all([
    prisma.recipe.create({
      data: {
        name: '닭가슴살 샐러드',
        ingredients: [{ name: '닭가슴살', grams: 120 }, { name: '시금치', grams: 60 }, { name: '당근', grams: 40 }],
        steps: ['닭가슴살을 소금과 후추로 밑간해요.', '팬에 닭가슴살을 노릇하게 구워요.', '시금치와 당근을 손질해 볼에 담아요.', '드레싱을 뿌려 가볍게 버무려요.'],
        cookingTime: 15,
        satisfaction: 5,
        calories: 320,
        carbs: 12,
        protein: 38,
        fat: 11,
        sodium: 420,
        sugar: 4,
        eatenDates: [subDays(new Date(), 2), subDays(new Date(), 12), subDays(new Date(), 25)]
      }
    }),
    prisma.recipe.create({
      data: {
        name: '두부 된장국',
        ingredients: [{ name: '두부', grams: 180 }, { name: '대파', grams: 20 }, { name: '마늘', grams: 8 }],
        steps: ['냄비에 물을 끓이고 된장을 풀어요.', '두부를 큼직하게 썰어 넣어요.', '대파와 마늘을 넣고 5분간 끓여 마무리해요.'],
        cookingTime: 20,
        satisfaction: 4,
        calories: 180,
        carbs: 10,
        protein: 16,
        fat: 8,
        sodium: 690,
        sugar: 3,
        eatenDates: [subDays(new Date(), 5), subDays(new Date(), 14)]
      }
    }),
    prisma.recipe.create({
      data: {
        name: '시금치 무침',
        ingredients: [{ name: '시금치', grams: 100 }, { name: '마늘', grams: 5 }, { name: '고추', grams: 10 }],
        steps: ['시금치를 데친 뒤 물기를 꼭 짜요.', '다진 마늘과 고추를 넣어요.', '참기름과 소금을 넣고 무쳐요.'],
        cookingTime: 10,
        satisfaction: 5,
        calories: 80,
        carbs: 8,
        protein: 3,
        fat: 4,
        sodium: 210,
        sugar: 1,
        eatenDates: [subDays(new Date(), 9)]
      }
    }),
    prisma.recipe.create({
      data: {
        name: '양파 감자볶음',
        ingredients: [{ name: '양파', grams: 120 }, { name: '감자', grams: 220 }, { name: '마늘', grams: 8 }],
        steps: ['양파와 감자를 얇게 썰어요.', '마늘향을 낸 뒤 감자를 먼저 볶아요.', '양파를 넣고 간을 맞춰 마무리해요.'],
        cookingTime: 18,
        satisfaction: 4,
        calories: 240,
        carbs: 32,
        protein: 4,
        fat: 9,
        sodium: 260,
        sugar: 5,
        eatenDates: [subDays(new Date(), 6)]
      }
    }),
    prisma.recipe.create({
      data: {
        name: '계란 대파 스크램블',
        ingredients: [{ name: '계란', grams: 180 }, { name: '대파', grams: 20 }, { name: '양파', grams: 40 }],
        steps: ['계란을 풀고 대파와 양파를 다져요.', '팬에 대파를 볶아 향을 내요.', '계란물을 넣고 부드럽게 익혀요.'],
        cookingTime: 12,
        satisfaction: 5,
        calories: 290,
        carbs: 6,
        protein: 18,
        fat: 20,
        sodium: 230,
        sugar: 3,
        eatenDates: [subDays(new Date(), 1), subDays(new Date(), 8)]
      }
    })
  ]);

  const usageRows = [
    ['닭가슴살', '닭가슴살 샐러드', 160, 2],
    ['시금치', '닭가슴살 샐러드', 60, 2],
    ['시금치', '시금치 무침', 60, 9],
    ['두부', '두부 된장국', 150, 5],
    ['당근', '닭가슴살 샐러드', 150, 2],
    ['감자', '양파 감자볶음', 200, 1],
    ['양파', '양파 감자볶음', 120, 1],
    ['계란', '계란 대파 스크램블', 180, 1],
    ['대파', '계란 대파 스크램블', 20, 1],
    ['양파', '계란 대파 스크램블', 40, 1],
    ['대파', '파전', 90, 3]
  ];

  for (const [ingredientName, menuName, gramsUsed, daysAgo] of usageRows) {
    const ingredient = ingredientMap[ingredientName];
    await prisma.usageHistory.create({
      data: {
        ingredientId: ingredient.id,
        menuName,
        gramsUsed,
        date: subDays(new Date(), daysAgo)
      }
    });
    await prisma.ingredient.update({
      where: { id: ingredient.id },
      data: { usedGrams: { increment: gramsUsed } }
    });
  }

  const diaryRows = [
    [subDays(new Date(), 2), '아침', '아침엔 양파 오믈렛과 샐러드를 먹었다.', recipes[4].id],
    [subDays(new Date(), 2), '점심', '닭가슴살 샐러드를 만들어 먹었다. 상쾌하고 가벼웠다.', recipes[0].id],
    [subDays(new Date(), 5), '저녁', '두부 된장국으로 속을 따뜻하게 달랬다.', recipes[1].id],
    [subDays(new Date(), 6), '점심', '양파 감자볶음을 넉넉히 만들어 도시락으로 챙겼다.', recipes[3].id],
    [subDays(new Date(), 9), '저녁', '시금치 무침과 밥으로 간단하게 먹었다.', recipes[2].id]
  ];

  for (const [date, mealType, diaryText, recipeId] of diaryRows) {
    await prisma.mealDiary.create({
      data: { date, mealType, diaryText, recipeId }
    });
  }

  const nutritionRows = [
    ['양파', 40, 9.34, 1.1, 0.1, 4, 4.2],
    ['닭가슴살', 165, 0, 31, 3.6, 74, 0],
    ['두부', 76, 1.9, 8, 4.8, 7, 0.6],
    ['시금치', 23, 3.6, 2.9, 0.4, 79, 0.4],
    ['당근', 41, 9.6, 0.9, 0.2, 69, 4.7],
    ['감자', 77, 17, 2, 0.1, 6, 0.8],
    ['계란', 155, 1.1, 13, 11, 124, 1.1],
    ['대파', 32, 7.3, 1.8, 0.2, 16, 2.3],
    ['마늘', 149, 33, 6.4, 0.5, 17, 1],
    ['고추', 40, 9, 2, 0.4, 9, 5.3]
  ];

  for (const [name, calories, carbs, protein, fat, sodium, sugar] of nutritionRows) {
    await prisma.nutritionInfo.create({
      data: { name, calories, carbs, protein, fat, sodium, sugar }
    });
  }

  await prisma.shoppingList.createMany({
    data: [
      { name: '올리브오일', note: '샐러드 드레싱용', checked: false, autoGenerated: false },
      { name: '방울토마토', note: '주말 샐러드 재료', checked: true, autoGenerated: false }
    ]
  });

  await prisma.notificationPreference.create({
    data: {
      expiringIngredientsEnabled: true,
      mealDiaryReminderEnabled: true,
      browserNotificationsEnabled: true,
      reminderHour: 20,
      checkIntervalMinutes: 30
    }
  });

  console.log('FreshTable seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
