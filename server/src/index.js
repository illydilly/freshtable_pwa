import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios'; // 異붽?
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { endOfDay, endOfMonth, formatISO, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { prisma } from './db.js';
import { buildDashboard } from './utils/dashboard.js';
import { normalizeIngredient } from './utils/ingredients.js';
import { buildWeeklyPurchaseTotals } from './utils/calendar.js';
import { buildMonthlyKpis, buildPurchaseTrend, buildTopIngredients, buildTopMenus } from './utils/statistics.js';
import { buildRecipeRecommendations } from './utils/recommendations.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const port = process.env.PORT || 4000;
function readSecret(name) {
  return process.env[name]?.trim().replace(/^["']|["']$/g, '');
}

const healthFunctionalFoodApiKey = readSecret('HEALTH_FUNCTIONAL_FOOD_API_KEY');
const cookedRecipeApiKey = readSecret('COOKED_RECIPE_API_KEY');
const foodNutritionApiKey = readSecret('FOOD_NUTRITION_API_KEY') || cookedRecipeApiKey;

function encodeServiceKey(key) {
  if (!key) return '';
  return key.includes('%') ? key : encodeURIComponent(key);
}

function getServiceKeyCandidates(key) {
  if (!key) return [];

  const candidates = new Set([encodeServiceKey(key)]);

  try {
    candidates.add(encodeURIComponent(decodeURIComponent(key)));
  } catch {
    candidates.add(encodeURIComponent(key));
  }

  return [...candidates].filter(Boolean);
}

function pickFirst(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '') {
      return item[key];
    }
  }
  return null;
}

function normalizeNutritionRows(items) {
  const normalizedItems = Array.isArray(items) ? items : [items];

  return normalizedItems
    .filter(Boolean)
    .map((item) => ({
      name: pickFirst(item, ['FOOD_NM_KR', 'FOOD_NM', 'DESC_KOR', 'foodName', 'food_nm_kr']) || '',
      calories: parseFloat(pickFirst(item, ['AMT_NUM1', 'NUTR_CONT1', 'ENERC', 'calories'])) || 0,
      carbs: parseFloat(pickFirst(item, ['AMT_NUM7', 'NUTR_CONT2', 'CHOCDF', 'carbs'])) || 0,
      protein: parseFloat(pickFirst(item, ['AMT_NUM3', 'NUTR_CONT3', 'PROT', 'protein'])) || 0,
      fat: parseFloat(pickFirst(item, ['AMT_NUM4', 'NUTR_CONT4', 'FATCE', 'fat'])) || 0,
      sugar: parseFloat(pickFirst(item, ['AMT_NUM8', 'NUTR_CONT5', 'SUGAR', 'sugar'])) || 0,
      sodium: parseFloat(pickFirst(item, ['AMT_NUM13', 'NUTR_CONT6', 'NAT', 'sodium'])) || 0
    }))
    .filter((item) => item.name);
}

function extractNutritionItems(data) {
  const candidates = [
    data?.body?.items?.item,
    data?.response?.body?.items?.item,
    data?.body?.items,
    data?.response?.body?.items
  ];

  const items = candidates.find((candidate) => Array.isArray(candidate) || (candidate && typeof candidate === 'object'));
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (Array.isArray(items.item)) return items.item;
  return [items];
}

async function searchDataGoKrNutrition(keyword) {
  const baseUrl = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02';
  let response;
  let lastError;

  for (const serviceKey of getServiceKeyCandidates(foodNutritionApiKey)) {
    const requestUrl =
      `${baseUrl}?serviceKey=${serviceKey}` +
      `&type=json&pageNo=1&numOfRows=10` +
      `&FOOD_NM_KR=${encodeURIComponent(keyword)}`;

    try {
      response = await axios.get(requestUrl, { timeout: 10000 });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError;
  }

  const resultCode = response.data?.response?.header?.resultCode || response.data?.header?.resultCode;
  const resultMsg = response.data?.response?.header?.resultMsg || response.data?.header?.resultMsg;

  if (resultCode && resultCode !== '00') {
    const error = new Error(resultMsg || resultCode);
    error.status = 502;
    throw error;
  }

  return normalizeNutritionRows(extractNutritionItems(response.data));
}

async function searchFoodSafetyNutrition(keyword) {
  const encodedKeyword = encodeURIComponent(keyword);
  const requestUrls = [
    `https://openapi.foodsafetykorea.go.kr/api/${foodNutritionApiKey}/I0750/json/1/20/DESC_KOR=${encodedKeyword}`,
    `http://openapi.foodsafetykorea.go.kr/api/${foodNutritionApiKey}/I0750/json/1/20/DESC_KOR=${encodedKeyword}`
  ];

  let response;
  let lastError;

  for (const requestUrl of requestUrls) {
    try {
      response = await axios.get(requestUrl, { timeout: 10000 });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError;
  }

  const resultCode = response.data?.I0750?.RESULT?.CODE;
  const resultMsg = response.data?.I0750?.RESULT?.MSG;

  if (resultCode === 'INFO-200') return [];

  if (resultCode && resultCode !== 'INFO-000') {
    const error = new Error(resultMsg || resultCode);
    error.status = resultCode === 'INFO-100' ? 401 : 502;
    throw error;
  }

  return normalizeNutritionRows(response.data?.I0750?.row || []);
}

async function getNotificationPreference() {
  let preference = await prisma.notificationPreference.findFirst();

  if (!preference) {
    preference = await prisma.notificationPreference.create({
      data: {
        expiringIngredientsEnabled: true,
        mealDiaryReminderEnabled: true,
        browserNotificationsEnabled: false,
        reminderHour: 20,
        checkIntervalMinutes: 60
      }
    });
  }

  return preference;
}
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));
// --- 여기에 로그인 API 코드를 추가합니다! ---
app.post('/api/login', async (req, res, next) => {
  try {
    const name = req.body?.name?.toString().trim();
    const phoneLast = req.body?.phoneLast?.toString().trim();

    if (!name || !phoneLast) {
      return res.status(400).json({ message: '이름과 전화번호 뒷자리를 입력해 주세요.' });
    }

    // 데이터베이스에서 이름과 전화번호 뒷자리가 일치하는 유저를 찾습니다
    const user = await prisma.user.findFirst({
      where: { 
        name: name, 
        phoneLast: phoneLast 
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// --- [?듭떖 湲곕뒫: ?쇳븨由ъ뒪???숆린?? ---
async function syncShoppingList() {
  const ingredients = await prisma.ingredient.findMany({ include: { purchase: true } });
  const lowStockIngredients = ingredients
    .map(normalizeIngredient)
    .filter((item) => item.remainingGrams <= 50)
    .map((item) => ({ name: item.name, remainingGrams: item.remainingGrams, note: `${item.name} ?ш퀬媛 ${item.remainingGrams}g ?⑥븯?댁슂.` }));

  const existingAutoItems = await prisma.shoppingList.findMany({ where: { autoGenerated: true, checked: false } });
  const lowStockNames = new Set(lowStockIngredients.map((item) => item.name));
  const staleIds = existingAutoItems.filter((item) => item.ingredientName && !lowStockNames.has(item.ingredientName)).map((item) => item.id);

  if (staleIds.length) await prisma.shoppingList.deleteMany({ where: { id: { in: staleIds } } });

  for (const ingredient of lowStockIngredients) {
    const existing = existingAutoItems.find((item) => item.ingredientName === ingredient.name);
    if (existing) await prisma.shoppingList.update({ where: { id: existing.id }, data: { name: ingredient.name, note: ingredient.note, remainingGrams: ingredient.remainingGrams } });
    else await prisma.shoppingList.create({ data: { name: ingredient.name, note: ingredient.note, autoGenerated: true, ingredientName: ingredient.name, remainingGrams: ingredient.remainingGrams } });
  }
  return prisma.shoppingList.findMany({ orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }] });
}

// --- [API ?쇱슦?? ---
app.get('/health', async (_req, res) => { try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); } catch (error) { res.status(500).json({ ok: false, message: error.message }); } });

// Real-time food nutrition search from the public FoodNtrCpntDbInfo02 API.
app.get('/api/search-food', async (req, res) => {
  try {
    const keyword = req.query.keyword?.toString().trim();

    if (!keyword) {
      return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    if (!foodNutritionApiKey) {
      const localItems = await prisma.nutritionInfo.findMany({
        where: { name: { contains: keyword, mode: 'insensitive' } },
        orderBy: { name: 'asc' },
        take: 10
      });

      if (localItems.length > 0) {
        return res.json(localItems);
      }

      return res.status(503).json({
        error: '공공 식품영양 API 키가 설정되지 않았습니다. Railway 백엔드 Variables에 FOOD_NUTRITION_API_KEY 또는 COOKED_RECIPE_API_KEY를 추가해 주세요.'
      });
    }

    const errors = [];

    for (const searcher of [searchFoodSafetyNutrition, searchDataGoKrNutrition]) {
      try {
        const items = await searcher(keyword);
        if (items.length > 0) {
          return res.json(items);
        }
      } catch (error) {
        errors.push(error);
      }
    }

    const localItems = await prisma.nutritionInfo.findMany({
      where: { name: { contains: keyword, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: 10
    });

    if (localItems.length > 0) {
      return res.json(localItems);
    }

    if (errors.length === 0) {
      return res.json([]);
    }

    const unauthorized = errors.find((error) => error?.status === 401 || error?.response?.status === 401);
    const detail = errors
      .map((error) => error?.response?.data?.message || error?.response?.data || error?.message)
      .find(Boolean);

    res.status(unauthorized ? 401 : 502).json({
      error: unauthorized
        ? '식품영양성분 DB 인증키가 거부되었습니다. FOOD_NUTRITION_API_KEY가 식품안전나라 I0750 또는 공공데이터포털 식품영양성분DB정보 키인지 확인해 주세요.'
        : `식품영양성분 DB 호출 실패: ${typeof detail === 'string' ? detail : '응답을 확인할 수 없습니다.'}`
    });
  } catch (error) {
    console.error('식품 검색 에러:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || '서버 검색 오류' });
  }
});

app.post('/api/register', async (req, res, next) => {
  try {
    const name = req.body?.name?.toString().trim();
    const phoneLast = req.body?.phoneLast?.toString().trim();
    const email = req.body?.email?.toString().trim().toLowerCase();

    if (!name || !phoneLast || !email) {
      return res.status(400).json({ message: '이름, 전화번호 뒷자리, 이메일을 모두 입력해 주세요.' });
    }

    if (!/^\d{4}$/.test(phoneLast)) {
      return res.status(400).json({ message: '전화번호 뒷자리는 숫자 4자리로 입력해 주세요.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { name, phoneLast }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({ message: '이미 등록된 사용자입니다. 로그인해 주세요.' });
    }

    const user = await prisma.user.create({
      data: { name, phoneLast, email }
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.get('/api/search-cooked-recipes', async (req, res) => {
  try {
    const keyword = req.query.keyword?.toString().trim();

    if (!keyword) {
      return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    if (!cookedRecipeApiKey) {
      return res.status(503).json({
        error: '조리식품 레시피 API 키가 설정되지 않았습니다. Railway 백엔드 Variables에 COOKED_RECIPE_API_KEY를 추가해 주세요.'
      });
    }

    const encodedKeyword = encodeURIComponent(keyword);
    const requestUrls = [
      `https://openapi.foodsafetykorea.go.kr/api/${cookedRecipeApiKey}/COOKRCP01/json/1/20/RCP_NM=${encodedKeyword}`,
      `http://openapi.foodsafetykorea.go.kr/api/${cookedRecipeApiKey}/COOKRCP01/json/1/20/RCP_NM=${encodedKeyword}`
    ];

    let response;
    let lastError;

    for (const requestUrl of requestUrls) {
      try {
        response = await axios.get(requestUrl, { timeout: 10000 });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) {
      const detail = lastError?.response?.data?.message || lastError?.response?.data || lastError?.message;
      return res.status(502).json({
        error: `조리식품 레시피 API 호출 실패: ${typeof detail === 'string' ? detail : '응답을 확인할 수 없습니다.'}`
      });
    }

    const resultCode = response.data?.COOKRCP01?.RESULT?.CODE;
    const resultMsg = response.data?.COOKRCP01?.RESULT?.MSG;

    if (resultCode && resultCode !== 'INFO-000') {
      return res.status(resultCode === 'INFO-200' ? 200 : 502).json(
        resultCode === 'INFO-200' ? [] : { error: `조리식품 레시피 API 오류: ${resultMsg || resultCode}` }
      );
    }

    const rows = response.data?.COOKRCP01?.row || [];
    const normalizedRows = Array.isArray(rows) ? rows : [rows];

    res.json(
      normalizedRows.map((item) => {
        const steps = Array.from({ length: 20 }, (_, index) => {
          const key = `MANUAL${String(index + 1).padStart(2, '0')}`;
          return item?.[key]?.trim();
        }).filter(Boolean);

        return {
          source: 'public',
          name: item?.RCP_NM || '',
          category: item?.RCP_PAT2 || '',
          cookingMethod: item?.RCP_WAY2 || '',
          ingredientsText: item?.RCP_PARTS_DTLS || '',
          ingredients: item?.RCP_PARTS_DTLS
            ? [{ name: item.RCP_PARTS_DTLS, grams: 0 }]
            : [],
          steps,
          cookingTime: 0,
          satisfaction: 0,
          calories: parseFloat(item?.INFO_ENG) || 0,
          carbs: parseFloat(item?.INFO_CAR) || 0,
          protein: parseFloat(item?.INFO_PRO) || 0,
          fat: parseFloat(item?.INFO_FAT) || 0,
          sodium: parseFloat(item?.INFO_NA) || 0,
          sugar: 0,
          thumbnail: item?.ATT_FILE_NO_MAIN || item?.ATT_FILE_NO_MK || '',
          eatenDates: []
        };
      })
    );
  } catch (error) {
    console.error('조리식품 레시피 검색 에러:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || '조리식품 레시피 검색 오류' });
  }
});



app.get('/api/dashboard', async (_req, res, next) => {

  try {

    res.json(await buildDashboard(prisma));

  } catch (error) {

    next(error);

  }

});



app.get('/api/purchases', async (req, res, next) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23,59,59,999); where.date.lte = t; }
    }
    const purchases = await prisma.purchase.findMany({ where, orderBy: { date: 'desc' } });
    res.json(purchases);
  } catch (error) { next(error); }
});



const purchaseItemSchema = z.object({

  date: z.string(),
  purpose: z.string().optional().nullable(),
  category: z.enum(['ingredient','dining-out']).default('ingredient'),

  itemName: z.string().min(1),

  price: z.coerce.number().int().nonnegative(),

  grams: z.coerce.number().int().positive(),

  source: z.string().min(1)

});

async function createPurchaseWithIngredient(item) {
  const category = item.category ?? 'ingredient';
  const purchase = await prisma.purchase.create({
    data: {
      date: new Date(item.date),
      itemName: item.itemName,
      price: item.price,
      grams: item.grams ?? 0,
      source: item.source,
      purpose: item.purpose ?? null,
      category,
    }
  });

  // 식재료 카테고리만 Ingredient 생성/업데이트 (외식은 건너뜀)
  if (category === 'ingredient' && item.grams > 0) {
    const existingIngredient = await prisma.ingredient.findUnique({ where: { name: item.itemName } });
    if (existingIngredient) {
      await prisma.ingredient.update({
        where: { id: existingIngredient.id },
        data: { purchaseId: purchase.id, totalGrams: existingIngredient.totalGrams + item.grams }
      });
    } else {
      await prisma.ingredient.create({
        data: { name: item.itemName, purchaseId: purchase.id, totalGrams: item.grams }
      });
    }
  }

  return purchase;
}

app.post('/api/purchases', async (req, res, next) => {
  try {
    const item = purchaseItemSchema.parse(req.body);
    const purchase = await createPurchaseWithIngredient(item);

    await syncShoppingList();

    res.status(201).json(purchase);
  } catch (error) {
    next(error);
  }
});



app.post('/api/purchases/bulk', async (req, res, next) => {

  try {

    const payload = z.object({ items: z.array(purchaseItemSchema).min(1) }).parse(req.body);

    const created = [];



    for (const item of payload.items) {

      const purchase = await createPurchaseWithIngredient(item);

      created.push(purchase);

    }



    await syncShoppingList();

    res.status(201).json(created);

  } catch (error) {

    next(error);

  }

});



// 구매내역 일괄 삭제 (#7)
app.delete('/api/purchases/bulk', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids 배열이 필요합니다.' });
    let count = 0;
    for (const id of ids.map(Number)) {
      try {
        const purchase = await prisma.purchase.findUnique({ where: { id }, include: { ingredient: { include: { usageHistory: true } } } });
        if (!purchase) continue;
        await prisma.$transaction(async (tx) => {
          if (purchase.ingredient) {
            await tx.usageHistory.deleteMany({ where: { ingredientId: purchase.ingredient.id } });
            await tx.shoppingList.deleteMany({ where: { ingredientName: purchase.ingredient.name } });
            await tx.ingredient.delete({ where: { id: purchase.ingredient.id } });
          }
          await tx.purchase.delete({ where: { id } });
        });
        count++;
      } catch {}
    }
    await syncShoppingList();
    res.json({ message: `${count}개 삭제 완료`, count });
  } catch (error) { next(error); }
});

// 외식 기록 조회
app.get('/api/purchases/dining-out', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { category: 'dining-out' };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); where.date.lte = t; }
    }
    const records = await prisma.purchase.findMany({ where, orderBy: { date: 'desc' } });
    res.json(records);
  } catch (error) { next(error); }
});

// 구매 내역 수정 (#1, #2)
app.put('/api/purchases/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = purchaseItemSchema.parse(req.body);
    const purchase = await prisma.purchase.findUnique({ where: { id }, include: { ingredient: true } });
    if (!purchase) return res.status(404).json({ message: '구매 내역을 찾을 수 없습니다.' });
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.update({ where: { id }, data: { itemName: payload.itemName, price: payload.price, grams: payload.grams, source: payload.source, date: new Date(payload.date) } });
      if (purchase.ingredient) {
        await tx.ingredient.update({ where: { id: purchase.ingredient.id }, data: { name: payload.itemName, totalGrams: payload.grams } });
      }
      return p;
    });
    await syncShoppingList();
    res.json(updated);
  } catch (error) { next(error); }
});

// 구매 내역 삭제 (식재료 cascade) (#1, #2)
app.delete('/api/purchases/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const purchase = await prisma.purchase.findUnique({ where: { id }, include: { ingredient: { include: { usageHistory: true } } } });
    if (!purchase) return res.status(404).json({ message: '구매 내역을 찾을 수 없습니다.' });
    await prisma.$transaction(async (tx) => {
      if (purchase.ingredient) {
        await tx.usageHistory.deleteMany({ where: { ingredientId: purchase.ingredient.id } });
        await tx.ingredient.delete({ where: { id: purchase.ingredient.id } });
      }
      await tx.purchase.delete({ where: { id } });
    });
    await syncShoppingList();
    res.json({ message: '삭제되었습니다.' });
  } catch (error) { next(error); }
});

app.get('/api/ingredients', async (req, res, next) => {

  try {

    const status = req.query.status || '?꾩껜';

    const ingredients = await prisma.ingredient.findMany({

      include: { purchase: true },

      orderBy: { purchase: { date: 'desc' } }

    });



    const normalized = ingredients.map(normalizeIngredient);

    res.json(status === '?꾩껜' ? normalized : normalized.filter((item) => item.status === status));

  } catch (error) {

    next(error);

  }

});



app.get('/api/ingredients/:id', async (req, res, next) => {

  try {

    const ingredient = await prisma.ingredient.findUnique({

      where: { id: Number(req.params.id) },

      include: {

        purchase: true,

        usageHistory: { orderBy: { date: 'desc' } }

      }

    });

    if (!ingredient) return res.status(404).json({ message: '?앹옱猷뚮? 李얠쓣 ???놁뒿?덈떎.' });

    res.json(normalizeIngredient(ingredient));

  } catch (error) {

    next(error);

  }

});



app.post('/api/ingredients/:id/usage', async (req, res, next) => {

  try {

    const ingredientId = Number(req.params.id);

    const payload = z.object({

      date: z.string(),

      menuName: z.string().min(1),

      gramsUsed: z.coerce.number().int().positive()

    }).parse(req.body);



    const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });

    if (!ingredient) return res.status(404).json({ message: '?앹옱猷뚮? 李얠쓣 ???놁뒿?덈떎.' });



    const updated = await prisma.$transaction(async (tx) => {

      await tx.usageHistory.create({

        data: {

          ingredientId,

          date: new Date(payload.date),

          menuName: payload.menuName,

          gramsUsed: payload.gramsUsed

        }

      });

      return tx.ingredient.update({

        where: { id: ingredientId },

        data: { usedGrams: ingredient.usedGrams + payload.gramsUsed },

        include: { purchase: true, usageHistory: { orderBy: { date: 'desc' } } }

      });

    });



    await syncShoppingList();

    res.status(201).json(normalizeIngredient(updated));

  } catch (error) {

    next(error);

  }

});



// 사용 내역 수정
app.put('/api/ingredients/:id/usage/:usageId', async (req, res, next) => {
  try {
    const ingredientId = Number(req.params.id);
    const usageId = Number(req.params.usageId);
    const payload = z.object({
      date: z.string(),
      menuName: z.string().min(1),
      gramsUsed: z.coerce.number().int().positive(),
      mealType: z.string().optional().nullable()
    }).parse(req.body);

    const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId }, include: { usageHistory: true } });
    if (!ingredient) return res.status(404).json({ message: '식재료를 찾을 수 없습니다.' });

    const oldUsage = ingredient.usageHistory.find((u) => u.id === usageId);
    if (!oldUsage) return res.status(404).json({ message: '사용 내역을 찾을 수 없습니다.' });

    const gramsDiff = payload.gramsUsed - oldUsage.gramsUsed;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.usageHistory.update({
        where: { id: usageId },
        data: { date: new Date(payload.date), menuName: payload.menuName, gramsUsed: payload.gramsUsed }
      });
      return tx.ingredient.update({
        where: { id: ingredientId },
        data: { usedGrams: Math.max(0, ingredient.usedGrams + gramsDiff) },
        include: { purchase: true, usageHistory: { orderBy: { date: 'desc' } } }
      });
    });

    await syncShoppingList();
    res.json(normalizeIngredient(updated));
  } catch (error) {
    next(error);
  }
});

// 사용 내역 삭제
app.delete('/api/ingredients/:id/usage/:usageId', async (req, res, next) => {
  try {
    const ingredientId = Number(req.params.id);
    const usageId = Number(req.params.usageId);

    const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId }, include: { usageHistory: true } });
    if (!ingredient) return res.status(404).json({ message: '식재료를 찾을 수 없습니다.' });

    const usage = ingredient.usageHistory.find((u) => u.id === usageId);
    if (!usage) return res.status(404).json({ message: '사용 내역을 찾을 수 없습니다.' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.usageHistory.delete({ where: { id: usageId } });
      return tx.ingredient.update({
        where: { id: ingredientId },
        data: { usedGrams: Math.max(0, ingredient.usedGrams - usage.gramsUsed) },
        include: { purchase: true, usageHistory: { orderBy: { date: 'desc' } } }
      });
    });

    await syncShoppingList();
    res.json(normalizeIngredient(updated));
  } catch (error) {
    next(error);
  }
});

// 식재료 유통기한/보관메모 수정
app.patch('/api/ingredients/:id', async (req, res, next) => {
  try {
    const ingredientId = Number(req.params.id);
    const payload = z.object({
      expiryDate: z.string().nullable().optional(),
      storageNote: z.string().nullable().optional()
    }).parse(req.body);

    const updated = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        storageNote: payload.storageNote ?? undefined
      },
      include: { purchase: true, usageHistory: { orderBy: { date: 'desc' } } }
    });

    res.json(normalizeIngredient(updated));
  } catch (error) {
    next(error);
  }
});

app.get('/api/recipes', async (_req, res, next) => {

  try {

    const recipes = await prisma.recipe.findMany({ orderBy: { createdAt: 'desc' } });

    res.json(recipes);

  } catch (error) {

    next(error);

  }

});



const recipeSchema = z.object({

  name: z.string().min(1),

  ingredients: z.array(z.object({ name: z.string(), grams: z.coerce.number() })),

  steps: z.array(z.string().min(1)),

  cookingTools: z.array(z.string()).default([]),

  cookingTime: z.coerce.number().int().positive(),

  satisfaction: z.coerce.number().int().min(1).max(5),

  calories: z.coerce.number().int().nonnegative(),

  carbs: z.coerce.number().nonnegative(),

  protein: z.coerce.number().nonnegative(),

  fat: z.coerce.number().nonnegative(),

  sodium: z.coerce.number().nonnegative(),

  sugar: z.coerce.number().nonnegative(),

  eatenDates: z.array(z.string()).default([])

});



app.post('/api/recipes', async (req, res, next) => {

  try {

    const payload = recipeSchema.parse(req.body);

    const recipe = await prisma.recipe.create({

      data: {

        ...payload,

        eatenDates: payload.eatenDates.map((date) => new Date(date))

      }

    });

    res.status(201).json(recipe);

  } catch (error) {

    next(error);

  }

});



app.get('/api/recipes/:id', async (req, res, next) => {

  try {

    const recipe = await prisma.recipe.findUnique({ where: { id: Number(req.params.id) } });

    if (!recipe) return res.status(404).json({ message: '?덉떆?쇰? 李얠쓣 ???놁뒿?덈떎.' });

    res.json(recipe);

  } catch (error) {

    next(error);

  }

});



app.get('/api/meal-diaries', async (req, res, next) => {

  try {

    const month = req.query.month ? parseISO(`${req.query.month}-01`) : new Date();

    const diaries = await prisma.mealDiary.findMany({

      where: {

        date: { gte: startOfMonth(month), lte: endOfMonth(month) }

      },

      include: { recipe: true },

      orderBy: { date: 'asc' }

    });

    const weeklyTotals = await buildWeeklyPurchaseTotals(prisma, month);

    res.json({ diaries, weeklyTotals });

  } catch (error) {

    next(error);

  }

});



app.post('/api/meal-diaries', upload.single('photo'), async (req, res, next) => {

  try {

    const body = req.body;

    let recipeId = body.recipeId ? Number(body.recipeId) : null;

    if (!recipeId && body.newRecipe) {

      const recipePayload = JSON.parse(body.newRecipe);

      const recipe = await prisma.recipe.create({

        data: {

          ...recipePayload,

          eatenDates: recipePayload.eatenDates?.map((date) => new Date(date)) || []

        }

      });

      recipeId = recipe.id;

    }



    const existing = await prisma.mealDiary.findFirst({

      where: { date: new Date(body.date), mealType: body.mealType }

    });



    const payload = {

      date: new Date(body.date),

      mealType: body.mealType,

      diaryText: body.diaryText || null,

      recipeId,

      photoUrl: req.file ? `/uploads/${req.file.filename}` : body.photoUrl || null,
      mealTime: body.mealTime || null,
      mealItems: body.mealItems ? (typeof body.mealItems === 'string' ? JSON.parse(body.mealItems) : body.mealItems) : [],
      mealCategory: body.mealCategory || 'home-cooked',
      diningOutId: body.diningOutId ? Number(body.diningOutId) : null,
    };



    const result = existing

      ? await prisma.mealDiary.update({ where: { id: existing.id }, data: payload, include: { recipe: true } })

      : await prisma.mealDiary.create({ data: payload, include: { recipe: true } });



    if (recipeId) {

      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });

      const dates = [...(recipe.eatenDates || []).map((date) => new Date(date).toISOString()), new Date(body.date).toISOString()];

      await prisma.recipe.update({ where: { id: recipeId }, data: { eatenDates: [...new Set(dates)].map((date) => new Date(date)) } });

    }



    res.status(201).json(result);

  } catch (error) {

    next(error);

  }

});



app.get('/api/nutrition', async (req, res, next) => {

  try {

    const query = req.query.query?.toString();

    const items = await prisma.nutritionInfo.findMany({

      where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,

      orderBy: { name: 'asc' }

    });

    res.json(items);

  } catch (error) {

    next(error);

  }

});



app.post('/api/nutrition', async (req, res, next) => {

  try {

    const payload = z.object({

      name: z.string().min(1),

      calories: z.coerce.number().int().nonnegative(),

      carbs: z.coerce.number().nonnegative(),

      protein: z.coerce.number().nonnegative(),

      fat: z.coerce.number().nonnegative(),

      sodium: z.coerce.number().nonnegative(),

      sugar: z.coerce.number().nonnegative()

    }).parse(req.body);



    const item = await prisma.nutritionInfo.upsert({

      where: { name: payload.name },

      update: payload,

      create: payload

    });

    res.status(201).json(item);

  } catch (error) {

    next(error);

  }

});



app.get('/api/settings/notifications', async (_req, res, next) => {

  try {

    res.json(await getNotificationPreference());

  } catch (error) {

    next(error);

  }

});



app.put('/api/settings/notifications', async (req, res, next) => {

  try {

    const current = await getNotificationPreference();

    const payload = z.object({

      expiringIngredientsEnabled: z.boolean(),

      mealDiaryReminderEnabled: z.boolean(),

      browserNotificationsEnabled: z.boolean(),

      reminderHour: z.coerce.number().int().min(0).max(23),

      checkIntervalMinutes: z.coerce.number().int().min(5).max(180)

    }).parse(req.body);



    const updated = await prisma.notificationPreference.update({

      where: { id: current.id },

      data: payload

    });



    res.json(updated);

  } catch (error) {

    next(error);

  }

});



app.get('/api/notifications/check', async (_req, res, next) => {

  try {

    const settings = await getNotificationPreference();

    const ingredients = await prisma.ingredient.findMany({ include: { purchase: true } });

    const todayMealCount = await prisma.mealDiary.count({

      where: {

        date: {

          gte: startOfDay(new Date()),

          lte: endOfDay(new Date())

        }

      }

    });



    const notifications = [];



    if (settings.expiringIngredientsEnabled) {
      const todayStart = startOfDay(new Date());
      ingredients
        .map(normalizeIngredient)
        .filter((item) => item.remainingGrams > 0)
        .forEach((item) => {
          if (item.expiryDate) {
            const expiry = startOfDay(new Date(item.expiryDate));
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysUntil = Math.round((expiry - todayStart) / msPerDay);
            if (daysUntil < 0) {
              notifications.push({ id: `expired-${item.id}`, type: 'expired', urgency: 'critical', title: '🚨 폐기 필수', message: `${item.name} 유통기한이 ${Math.abs(daysUntil)}일 지났습니다. 즉시 확인하고 폐기해주세요.`, ingredientId: item.id });
            } else if (daysUntil === 0) {
              notifications.push({ id: `expiring-today-${item.id}`, type: 'danger', urgency: 'high', title: '🔴 오늘 유통기한 위험', message: `${item.name} 유통기한이 오늘까지입니다. 오늘 안에 사용하세요.`, ingredientId: item.id });
            } else if (daysUntil === 1) {
              notifications.push({ id: `expiring-soon-${item.id}`, type: 'warning', urgency: 'medium', title: '⚠️ 유통기한 하루 전 주의', message: `${item.name} 유통기한이 내일까지입니다. 오늘 또는 내일 중 사용하세요.`, ingredientId: item.id });
            }
          } else if (item.purchase && new Date(item.purchase.date).getTime() <= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).getTime()) {
            notifications.push({ id: `expiring-${item.id}`, type: 'expiring', urgency: 'low', title: '임박 식재료 알림', message: `${item.name} 재고가 ${item.remainingGrams}g 남아있고 구매 후 14일 이상 지났습니다.`, ingredientId: item.id });
          }
        });
    }



    if (settings.mealDiaryReminderEnabled && todayMealCount === 0) {

      notifications.push({

        id: `diary-${formatISO(new Date(), { representation: 'date' })}`,

        type: 'meal-diary',

        title: '?앸떒 ?쇨린 由щ쭏?몃뜑',

        message: '?ㅻ뒛 ?앸떒 ?쇨린媛 ?꾩쭅 鍮꾩뼱 ?덉뼱?? ????꾩뿉 ??以??④꺼蹂댁꽭??'

      });

    }



    res.json({

      checkedAt: new Date().toISOString(),

      settings,

      notifications

    });

  } catch (error) {

    next(error);

  }

});



app.get('/api/statistics/purchase-trend', async (_req, res, next) => {

  try {

    res.json(await buildPurchaseTrend(prisma));

  } catch (error) {

    next(error);

  }

});



app.get('/api/statistics/top-ingredients', async (_req, res, next) => {

  try {

    res.json(await buildTopIngredients(prisma));

  } catch (error) {

    next(error);

  }

});



app.get('/api/statistics/top-menus', async (_req, res, next) => {

  try {

    res.json(await buildTopMenus(prisma));

  } catch (error) {

    next(error);

  }

});



app.get('/api/statistics/monthly-kpis', async (_req, res, next) => {

  try {

    res.json(await buildMonthlyKpis(prisma));

  } catch (error) {

    next(error);

  }

});

app.get('/api/statistics/kpis', async (_req, res, next) => {

  try {

    res.json(await buildMonthlyKpis(prisma));

  } catch (error) {

    next(error);

  }

});



app.get('/api/shopping-list', async (_req, res, next) => {

  try {

    res.json(await syncShoppingList());

  } catch (error) {

    next(error);

  }

});



app.post('/api/shopping-list', async (req, res, next) => {

  try {

    const payload = z.object({

      name: z.string().min(1),

      note: z.string().optional().nullable()

    }).parse(req.body);



    const item = await prisma.shoppingList.create({

      data: {

        name: payload.name,

        note: payload.note || null,

        autoGenerated: false

      }

    });



    res.status(201).json(item);

  } catch (error) {

    next(error);

  }

});



app.patch('/api/shopping-list/:id', async (req, res, next) => {
  try {
    const itemId = Number(req.params.id);
    const payload = z.object({
      checked: z.boolean().optional(),
      name: z.string().min(1).optional(),
      note: z.string().nullable().optional(),
      // #3: 체크 시 구매내역 자동 반영을 위한 선택적 가격/그램 정보
      price: z.coerce.number().nonnegative().optional(),
      grams: z.coerce.number().positive().optional(),
    }).parse(req.body);

    const item = await prisma.shoppingList.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ message: '항목을 찾을 수 없습니다.' });

    const { price, grams, ...updateData } = payload;
    const updated = await prisma.shoppingList.update({ where: { id: itemId }, data: updateData });

    // #3: 수동 등록 항목을 '구매 완료'로 체크하면 구매내역(식재료)에 자동 반영
    if (payload.checked === true && !item.autoGenerated) {
      await createPurchaseWithIngredient({
        itemName: item.name,
        price: price ?? 0,
        grams: grams ?? 200,
        source: '장보기 체크리스트',
        date: new Date().toISOString(),
        category: 'ingredient',
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});



app.delete('/api/shopping-list/:id', async (req, res, next) => {

  try {

    await prisma.shoppingList.delete({ where: { id: Number(req.params.id) } });

    res.status(204).send();

  } catch (error) {

    next(error);

  }

});



app.get('/api/recommendations', async (req, res, next) => {

  try {

    const threshold = req.query.threshold ? Number(req.query.threshold) : 60;

    res.json(await buildRecipeRecommendations(prisma, threshold));

  } catch (error) {

    next(error);

  }

});



// 식재료 삭제 (#5)
app.delete('/api/ingredients/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: { usageHistory: true, purchase: true } });
    if (!ingredient) return res.status(404).json({ message: '식재료를 찾을 수 없습니다.' });
    await prisma.$transaction(async (tx) => {
      await tx.usageHistory.deleteMany({ where: { ingredientId: id } });
      await tx.shoppingList.deleteMany({ where: { ingredientName: ingredient.name } });
      await tx.ingredient.delete({ where: { id } });
      if (ingredient.purchase) await tx.purchase.delete({ where: { id: ingredient.purchaseId } });
    });
    await syncShoppingList();
    res.json({ message: '삭제되었습니다.' });
  } catch (error) { next(error); }
});

// 식재료 이름/용도 수정 (#5, #11)
app.patch('/api/ingredients/:id/info', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, purpose } = req.body;
    const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: { purchase: true } });
    if (!ingredient) return res.status(404).json({ message: '식재료를 찾을 수 없습니다.' });
    await prisma.$transaction(async (tx) => {
      if (name && name !== ingredient.name) {
        await tx.ingredient.update({ where: { id }, data: { name } });
        await tx.purchase.update({ where: { id: ingredient.purchaseId }, data: { itemName: name } });
        await tx.shoppingList.updateMany({ where: { ingredientName: ingredient.name }, data: { ingredientName: name, name } });
      }
      if (purpose !== undefined) {
        await tx.purchase.update({ where: { id: ingredient.purchaseId }, data: { purpose } });
      }
    });
    await syncShoppingList();
    const updated = await prisma.ingredient.findUnique({ where: { id }, include: { purchase: true, usageHistory: { orderBy: { date: 'desc' } } } });
    res.json(normalizeIngredient(updated));
  } catch (error) { next(error); }
});

// 레시피 수정 (#8)
app.put('/api/recipes/:id', upload.single('photo'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const payload = recipeSchema.parse({
      ...body,
      cookingTools: body.cookingTools ? JSON.parse(body.cookingTools) : [],
      ingredients: body.ingredients ? JSON.parse(body.ingredients) : [],
      steps: body.steps ? JSON.parse(body.steps) : [],
      eatenDates: body.eatenDates ? JSON.parse(body.eatenDates) : []
    });
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) return res.status(404).json({ message: '레시피를 찾을 수 없습니다.' });

    const thumbnailUrl = req.file ? `/uploads/${req.file.filename}` : (body.thumbnailUrl || recipe.thumbnailUrl || null);

    const updated = await prisma.recipe.update({
      where: { id },
      data: {
        name: payload.name,
        thumbnailUrl,
        ingredients: payload.ingredients,
        steps: payload.steps,
        cookingTools: payload.cookingTools,
        cookingTime: payload.cookingTime,
        satisfaction: payload.satisfaction,
        calories: payload.calories,
        carbs: payload.carbs,
        protein: payload.protein,
        fat: payload.fat,
        sodium: payload.sodium,
        sugar: payload.sugar,
        eatenDates: payload.eatenDates.map(d => new Date(d))
      }
    });
    res.json(updated);
  } catch (error) { next(error); }
});

// 식재료 선택 기반 레시피 추천 (#11, #15)
app.post('/api/recommendations/by-ingredients', async (req, res, next) => {
  try {
    const { selectedIngredients = [], selectedTools = [], keyword = '' } = req.body;
    const savedRecipes = await prisma.recipe.findMany();

    // #4: 키워드 직접 입력 없이도 선택한 식재료명으로 공공 레시피 자동 검색
    let publicRecipes = [];
    const apiKey = process.env.FOOD_SAFETY_API_KEY || process.env.OPEN_API_KEY || '';
    if (apiKey) {
      // 선택된 식재료(최대 3개) + 직접 입력 키워드를 함께 검색어로 사용
      const searchTerms = [...new Set([...selectedIngredients.slice(0, 3), keyword].filter(Boolean))];
      const publicMap = new Map(); // 이름 기준 중복 제거

      await Promise.all(searchTerms.map(async (term) => {
        try {
          const encKeyword = encodeURIComponent(term);
          const url = `http://openapi.foodsafetykorea.go.kr/api/${apiKey}/COOKRCP01/json/1/20/RCP_NM=${encKeyword}`;
          const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
          const d = await r.json();
          const rows = d?.COOKRCP01?.row || [];
          rows.forEach(row => {
            const name = row.RCP_NM || '';
            if (!name || publicMap.has(name)) return;
            publicMap.set(name, {
              id: null, name, calories: Number(row.INFO_ENG) || 0,
              ingredients: (row.RCP_PARTS_DTLS || '').split(/[,·\n]+/).map(s => ({ name: s.trim(), grams: 0 })).filter(i => i.name),
              cookingTools: [], steps: [], carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0,
              cookingTime: 30, satisfaction: 3, source: 'public', eatenDates: []
            });
          });
        } catch {}
      }));

      publicRecipes = Array.from(publicMap.values());
    }

    const score = (recipe) => {
      const ingNames = (recipe.ingredients || []).map(i => (typeof i === 'string' ? i : i.name || '').toLowerCase());
      const tools = recipe.cookingTools?.length
        ? (recipe.cookingTools || []).map(t => (typeof t === 'string' ? t : '').toLowerCase())
        : ingNames; // #14: 조리도구 미입력 시 모든 재료로 대체
      const allTags = [...ingNames, ...tools];
      let score = 0;
      selectedIngredients.forEach(si => { if (allTags.some(t => t.includes(si.toLowerCase()) || si.toLowerCase().includes(t))) score++; });
      selectedTools.forEach(st => { if (tools.some(t => t.includes(st.toLowerCase()) || st.toLowerCase().includes(t))) score += 0.5; });
      return score;
    };

    const allRecipes = [
      ...savedRecipes.map(r => ({ ...r, source: 'saved' })),
      ...publicRecipes.map(r => ({ ...r, source: 'public' }))
    ];

    if (!selectedIngredients.length && !selectedTools.length) {
      return res.json(allRecipes.slice(0, 15).map(r => ({ ...r, matchScore: 0 })));
    }

    const scored = allRecipes
      .map(r => ({ ...r, matchScore: score(r) }))
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json(scored.slice(0, 20));
  } catch (error) { next(error); }
});

// 기간별 통계 데이터 (#9)
app.get('/api/statistics/period', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate   = to   ? new Date(to)   : new Date();
    toDate.setHours(23, 59, 59, 999);

    const [purchases, diaries] = await Promise.all([
      prisma.purchase.findMany({ where: { date: { gte: fromDate, lte: toDate } }, orderBy: { date: 'asc' } }),
      prisma.mealDiary.findMany({ where: { date: { gte: fromDate, lte: toDate } }, include: { recipe: true }, orderBy: { date: 'asc' } })
    ]);

    const dailySpend = {};
    purchases.forEach(p => {
      const key = p.date.toISOString().slice(0, 10);
      dailySpend[key] = (dailySpend[key] || 0) + p.price;
    });

    res.json({
      purchases,
      diaries: diaries.map(d => ({
        id: d.id, date: d.date, mealType: d.mealType, mealTime: d.mealTime,
        recipeName: d.recipe?.name || d.diaryText || '',
        calories: d.recipe?.calories || 0
      })),
      dailySpend: Object.entries(dailySpend).map(([date, amount]) => ({ date, amount })),
      summary: {
        totalSpend: purchases.reduce((s, p) => s + p.price, 0),
        totalCalories: diaries.reduce((s, d) => s + (d.recipe?.calories || 0), 0),
        purchaseCount: purchases.length,
        diaryCount: diaries.length
      }
    });
  } catch (error) { next(error); }
});


// ── 영양정보 자동 계산 (DB → 공공API → AI) ─────────────────────────────
function applyRatio(base, ratio) {
  return {
    calories: Math.round((Number(base.calories) || 0) * ratio),
    carbs:    Math.round(((Number(base.carbs)   || 0) * ratio) * 100) / 100,
    protein:  Math.round(((Number(base.protein) || 0) * ratio) * 100) / 100,
    fat:      Math.round(((Number(base.fat)     || 0) * ratio) * 100) / 100,
    sodium:   Math.round(((Number(base.sodium)  || 0) * ratio) * 100) / 100,
    sugar:    Math.round(((Number(base.sugar)   || 0) * ratio) * 100) / 100,
  };
}
function addToTotal(total, nut) {
  Object.keys(nut).forEach(k => {
    total[k] = Math.round(((total[k] || 0) + (nut[k] || 0)) * 100) / 100;
  });
}

// Step1: DB, Step2: 공공API → 재료별 영양 계산
app.post('/api/nutrition/calculate', async (req, res, next) => {
  try {
    const { ingredients } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.json({ total: { calories:0,carbs:0,protein:0,fat:0,sodium:0,sugar:0 }, perIngredient:[], missingCount:0 });
    }

    const results = [];
    const total = { calories:0, carbs:0, protein:0, fat:0, sodium:0, sugar:0 };

    for (const ing of ingredients) {
      const name = ing.name?.trim();
      const grams = Number(ing.grams);
      if (!name || !grams || grams <= 0) continue;
      const ratio = grams / 100;

      // ① NutritionInfo DB
      const dbEntry = await prisma.nutritionInfo.findFirst({
        where: { name: { contains: name, mode: 'insensitive' } }
      });
      if (dbEntry) {
        const nut = applyRatio(dbEntry, ratio);
        addToTotal(total, nut);
        results.push({ name, grams, found: true, source: 'db', ...nut });
        continue;
      }

      // ② 공공 식품 API (기존 searcher 재사용, normalizeNutritionRows로 이미 정규화됨)
      let found = false;
      if (foodNutritionApiKey) {
        for (const searcher of [searchFoodSafetyNutrition, searchDataGoKrNutrition]) {
          try {
            const items = await searcher(name);
            if (Array.isArray(items) && items.length > 0) {
              const item = items[0]; // { name, calories, carbs, protein, fat, sugar, sodium }
              const base = {
                calories: item.calories || 0,
                carbs:    item.carbs    || 0,
                protein:  item.protein  || 0,
                fat:      item.fat      || 0,
                sodium:   item.sodium   || 0,
                sugar:    item.sugar    || 0,
              };
              const foundName = item.name || name;
              // 조회된 항목 DB에 저장 (다음 조회 시 빠르게)
              await prisma.nutritionInfo.upsert({
                where: { name: foundName },
                update: {},
                create: { name: foundName, ...base }
              }).catch(() => {});
              const nut = applyRatio(base, ratio);
              addToTotal(total, nut);
              results.push({ name, grams, found: true, source: 'api', apiName: foundName, ...nut });
              found = true;
              break;
            }
          } catch {}
        }
      }
      if (!found) results.push({ name, grams, found: false, source: null });
    }

    const missing = results.filter(r => !r.found);
    res.json({ total, perIngredient: results, missingCount: missing.length, missingIngredients: missing.map(m => ({ name: m.name, grams: m.grams })) });
  } catch (error) { next(error); }
});

// Step3: Claude AI로 미확인 재료 영양 추정
app.post('/api/nutrition/estimate-ai', async (req, res, next) => {
  try {
    const { ingredients } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: '재료 목록이 없습니다.' });
    }
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ message: 'AI 서비스 키가 설정되지 않았습니다. Railway Variables에 ANTHROPIC_API_KEY를 추가해 주세요.' });
    }

    const ingredientText = ingredients.map(i => `${i.name} ${i.grams}g`).join(', ');
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `다음 재료들의 총 영양정보를 추정해 주세요. 입력된 전체 그램수 기준으로 합산하세요.
재료: ${ingredientText}
JSON만 응답 (설명 없이):
{"calories":숫자,"carbs":숫자,"protein":숫자,"fat":숫자,"sodium":숫자,"sugar":숫자}`
        }]
      },
      { headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: 15000 }
    );

    const text = response.data?.content?.[0]?.text || '{}';
    const clean = text.replace(/```(?:json)?\n?|```/g, '').trim();
    const nutrition = JSON.parse(clean);
    res.json({ ...nutrition, source: 'ai', estimated: true });
  } catch (error) {
    if (error.response?.status === 401) return res.status(401).json({ message: 'AI API 키가 유효하지 않습니다.' });
    next(error);
  }
});

app.get('/api/recipe-placeholder/:name', (req, res) => {

  const name = decodeURIComponent(req.params.name);

  res.type('svg').send(`

    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" fill="none">

      <rect width="320" height="180" rx="24" fill="#F1F7ED"/>

      <circle cx="88" cy="90" r="42" fill="#DCEACF"/>

      <circle cx="112" cy="76" r="16" fill="#7FB069" fill-opacity="0.9"/>

      <circle cx="144" cy="102" r="18" fill="#FFB84D" fill-opacity="0.75"/>

      <text x="190" y="82" font-family="Pretendard, Arial" font-size="20" font-weight="700" fill="#1F2937">${name}</text>

      <text x="190" y="112" font-family="Pretendard, Arial" font-size="13" fill="#64748B">FreshTable Recipe</text>

    </svg>

  `);

});



app.get('/api/meta/sidebar', (_req, res) => {

  res.json([

    { key: 'dashboard', label: '대시보드', path: '/' },

    { key: 'purchases', label: '구매내역', path: '/purchases' },

    { key: 'ingredients', label: '식재료', path: '/ingredients' },

    { key: 'recipes', label: '메뉴·레시피', path: '/recipes' },

    { key: 'meal-diary', label: '식단 일기', path: '/meal-diary' },

    { key: 'nutrition', label: '영양정보', path: '/nutrition' },

    { key: 'notifications', label: '알림 설정', path: '/settings/notifications' },

    { key: 'stats', label: '통계', path: '/statistics' },

    { key: 'shopping', label: '장보기 리스트', path: '/shopping-list' },

    { key: 'recommend', label: '레시피 추천', path: '/recommendations' }

  ]);

});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.name === 'ZodError') {
    return res.status(400).json({
      message: '?낅젰媛믪씠 ?щ컮瑜댁? ?딆뒿?덈떎.',
      details: error.errors
    });
  }

  res.status(500).json({
    message: error.message || '?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'
  });
});

// 포트 리스너만 남기고 중복된 로그인 코드는 제거합니다.
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}!`);
});
