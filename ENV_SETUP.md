# FreshTable 환경변수 설정 가이드

배포할 때는 프론트엔드와 백엔드가 서로의 주소를 알아야 합니다.

## 1. Vercel에 넣을 값
프론트엔드는 Vite이므로 `VITE_` 로 시작해야 합니다.

### 필수 변수
```bash
VITE_API_URL=https://your-backend.up.railway.app
```

### 의미
- 프론트엔드에서 호출할 백엔드 주소
- 최종 예시: `https://freshtable-api.up.railway.app`

### 어디에 넣나요?
- Vercel 프로젝트
- `Settings` → `Environment Variables`

## 2. Railway에 넣을 값

### 필수 변수
```bash
DATABASE_URL=Railway PostgreSQL 연결 문자열
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 의미
- `DATABASE_URL`: Railway PostgreSQL에서 제공하는 연결 문자열
- `NODE_ENV`: 프로덕션 모드 지정
- `CORS_ORIGIN`: 브라우저에서 백엔드 호출을 허용할 프론트 주소

### 어디에 넣나요?
- Railway 백엔드 서비스
- `Variables` 탭

## 3. 입력 순서 추천
1. Railway 백엔드 먼저 배포
2. Railway 공개 도메인 복사
3. Vercel에 `VITE_API_URL` 입력 후 프론트 배포
4. Vercel 배포 주소 복사
5. Railway에 `CORS_ORIGIN` 입력
6. Railway 재배포
7. Vercel도 한 번 다시 Redeploy

## 4. 복붙용 예시

### 예시 A. Vercel
```bash
VITE_API_URL=https://freshtable-api.up.railway.app
```

### 예시 B. Railway
```bash
NODE_ENV=production
CORS_ORIGIN=https://freshtable.vercel.app
```

## 5. 여러 도메인을 허용하고 싶을 때
이 프로젝트는 쉼표로 구분된 여러 origin도 허용하도록 구성되어 있습니다.

예시:
```bash
CORS_ORIGIN=https://freshtable.vercel.app,https://freshtable-git-main-yourname.vercel.app
```

## 6. 로컬 개발용 예시

### client/.env.example
```bash
VITE_API_URL=http://localhost:4000
```

### server/.env.example
```bash
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freshtable?schema=public"
CORS_ORIGIN="http://localhost:5173"
CLIENT_URL="http://localhost:5173"
```
