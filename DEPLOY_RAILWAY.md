# FreshTable Railway 배포 가이드

FreshTable 백엔드와 PostgreSQL 데이터베이스는 Railway에 배포합니다. 이 프로젝트는 Prisma와 PostgreSQL을 사용하며, 배포 시 마이그레이션이 자동 실행되도록 준비되어 있습니다.

## 0. 시작 전에 준비할 것
- 압축을 푼 FreshTable 프로젝트 폴더
- Railway 계정
- 가능하면 GitHub 저장소
- GitHub가 없다면 Railway CLI로도 배포 가능

## 1. 가장 쉬운 방법: GitHub 연결 배포

### 1-1. Railway 로그인
- https://railway.app 접속
- GitHub 계정으로 로그인하면 가장 편합니다.

### 1-2. 새 프로젝트 만들기
- `New Project` 클릭
- `Deploy from GitHub repo` 선택
- FreshTable 저장소 선택

### 1-3. PostgreSQL 추가
- 프로젝트 안에서 `+ New` 또는 `Add Service`
- `Database` → `PostgreSQL`
- PostgreSQL 서비스가 생성되면 자동으로 관련 변수들이 생깁니다.

### 1-4. 백엔드 서비스 환경변수 설정
백엔드 서비스의 `Variables` 탭에서 아래 값을 확인하거나 추가합니다.

필수:
- `DATABASE_URL` = PostgreSQL 서비스 변수 참조 또는 자동 연결값
- `NODE_ENV` = `production`
- `CORS_ORIGIN` = Vercel 프론트엔드 주소

예시:

```bash
NODE_ENV=production
CORS_ORIGIN=https://freshtable.vercel.app
```

### 1-5. 배포 시작
- `railway.json` 과 `Procfile` 이 이미 준비되어 있으므로 별도 코드 수정 없이 배포 가능
- 첫 배포 시 `npm install` → `prisma generate` → 실행 단계에서 `prisma migrate deploy` → `npm start` 순서로 진행됩니다.

### 1-6. 공개 도메인 만들기
- 백엔드 서비스 선택
- `Settings` 탭 이동
- `Networking` → `Public Networking`
- `Generate Domain` 클릭
- `https://...up.railway.app` 주소가 생기면 복사

이 URL을 Vercel의 `VITE_API_URL` 로 사용합니다.

## 2. GitHub 없이 배포하는 방법

Railway도 ZIP 파일을 웹에 바로 올리는 방식보다, **ZIP을 푼 로컬 폴더를 Railway CLI로 업로드하는 방법**이 가장 간단합니다.

### 2-1. Railway CLI 설치
```bash
npm i -g @railway/cli
```

### 2-2. 로그인
```bash
railway login
```

### 2-3. 프로젝트 생성 또는 연결
```bash
railway init
```

### 2-4. PostgreSQL 서비스 추가
이 단계는 대시보드에서 하는 것이 가장 쉬워요.
- Railway 대시보드로 이동
- 현재 프로젝트에 PostgreSQL 추가
- 백엔드 서비스의 Variables 탭에서 `DATABASE_URL` 확인

### 2-5. 코드 업로드 배포
프로젝트 루트에서 실행:

```bash
railway up
```

서비스가 여러 개이면 프롬프트에 따라 백엔드 서비스 대상을 선택합니다.

## 3. Prisma 관련 주의사항
- 이 프로젝트는 `migrate:deploy` 스크립트를 사용합니다.
- Railway 배포 시 데이터베이스 스키마가 자동 반영됩니다.
- 샘플 데이터를 넣고 싶다면 배포 후 한 번만 수동으로 `npm run seed` 를 실행하거나 로컬에서 먼저 넣은 DB를 사용하세요.

## 4. 배포 후 꼭 확인할 것
- `/health` 접속 시 `{"ok":true}` 가 보이는지
- `/api/dashboard` 응답이 오는지
- 로그에 Prisma 연결 에러가 없는지
- Vercel 주소를 `CORS_ORIGIN` 으로 넣었는지

## 5. 자주 막히는 문제

### 문제 1. Prisma 연결 오류
원인:
- `DATABASE_URL` 누락
- PostgreSQL 서비스와 앱 서비스가 연결되지 않음

해결:
- Variables 탭에서 `DATABASE_URL` 값 확인
- PostgreSQL 생성 후 백엔드 서비스에 참조 변수 연결

### 문제 2. 프론트에서 CORS 오류
원인:
- `CORS_ORIGIN` 값이 실제 Vercel URL과 다름
- `https://` 없이 입력함

해결:
- 정확한 Vercel 주소 전체를 복사해 사용
- 예: `https://freshtable.vercel.app`

### 문제 3. 배포는 됐는데 500 에러가 나요
원인:
- 마이그레이션 실패
- 시드 데이터 스크립트 기대값과 DB 상태 불일치

해결:
- Deploy Logs 확인
- 필요하면 `Redeploy`
- Prisma 로그 메시지부터 확인

## 6. 초보자용 한 줄 요약
1. Railway 프로젝트 생성
2. GitHub 저장소 연결 또는 `railway up`
3. PostgreSQL 추가
4. `DATABASE_URL`, `NODE_ENV`, `CORS_ORIGIN` 설정
5. `Generate Domain`
6. 발급 URL을 Vercel의 `VITE_API_URL` 로 입력
