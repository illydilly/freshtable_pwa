-- ════════════════════════════════════════════════════════════════════
-- 기능 1: 재구매(재등록) 프로세스 — Ingredient.name unique 제약 제거
-- ════════════════════════════════════════════════════════════════════
-- 같은 이름의 식재료라도 구매 배치(batch)마다 별도 row를 가질 수 있도록
-- unique 제약을 인덱스로 교체. 기존 데이터에는 영향 없음(이미 이름이 겹치는
-- row가 없으므로 안전하게 제거 가능).
ALTER TABLE "Ingredient" DROP CONSTRAINT IF EXISTS "Ingredient_name_key";
CREATE INDEX IF NOT EXISTS "Ingredient_name_idx" ON "Ingredient"("name");

-- ════════════════════════════════════════════════════════════════════
-- 기능 2: 장보기 스마트 추천 — 알림 활성화 플래그
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "isAlertEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════
-- 기능 3: 입력 단위 다양화 (개수 / g / ml)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "unitType" TEXT NOT NULL DEFAULT 'g';
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "unitAmount" DOUBLE PRECISION;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "unitCount" DOUBLE PRECISION;
