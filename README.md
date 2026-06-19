# FreshTable

개인용 식재료 & 식단 관리 풀스택 웹앱입니다.

## Stack
- Frontend: React 18 + Vite + TailwindCSS + Recharts
- Backend: Node.js + Express + Prisma + PostgreSQL
- OCR: Tesseract.js

## Phase 1
- 구매내역 OCR 등록
- 식재료 인벤토리 및 사용 내역
- 메뉴·레시피 관리
- 식단 일기 달력
- 영양정보 검색

## Phase 2
- 알림 & 리마인더 (`/settings/notifications`, `GET /api/notifications/check`)
- 통계 & 리포트 (`/statistics`, `/api/statistics/*`)
- 장보기 리스트 (`/shopping-list`, `/api/shopping-list/*`)
- 레시피 추천 (`/recommendations`, `GET /api/recommendations`)

## Local Run
1. `cp server/.env.example server/.env`
2. `server/.env`에 PostgreSQL 연결 문자열을 설정합니다.
3. 루트에서 `npm install`
4. `npm --workspace server run prisma:generate`
5. `npm --workspace server run prisma:push`
6. `npm run seed`
7. 터미널 1에서 `npm --workspace server run dev`
8. 터미널 2에서 `npm --workspace client run dev`
9. 브라우저에서 `http://localhost:5173` 접속

## PWA 기능
- 홈 화면에 추가 가능 (`manifest.json`, 설치 프롬프트 버튼)
- Service Worker 캐싱 (`client/public/sw.js`)
- 오프라인 페이지 (`client/public/offline.html`)
- 세이지 그린 기반 앱 아이콘 8종 (`client/public/icons/*`)
- 오프라인 상태 배너 및 복구 토스트

## Build
- 루트에서 `npm run build`

## Production Deploy
- 프론트엔드(Vercel): `vercel.json`과 `client/.env.example` 참고
- 백엔드+DB(Railway): `railway.json`, `Procfile`, `server/.env.example` 참고
- 자세한 단계별 가이드: `DEPLOY_VERCEL.md`, `DEPLOY_RAILWAY.md`, `ENV_SETUP.md`, `DEPLOYMENT_CHECKLIST.md`

## PWA 테스트
1. 클라이언트 실행 후 대시보드 상단의 `앱 설치하기` 버튼으로 설치 프롬프트 확인
2. DevTools > Application > Manifest / Service Workers 에서 등록 여부 확인
3. 네트워크를 Offline 으로 전환해도 기본 페이지와 아이콘이 유지되는지 확인
4. 프로덕션 빌드 후 Lighthouse PWA 점수 확인

## Sample Data
- 식재료 10종
- 레시피 5종
- 사용 내역 / 식단 일기 / 영양정보 시드 포함
- 장보기 리스트 / 알림 설정 초기값 포함
