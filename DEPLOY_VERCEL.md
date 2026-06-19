# FreshTable Vercel 배포 가이드

FreshTable 프론트엔드는 Vercel에 배포합니다. 이 프로젝트는 React + Vite 기반이며, PWA 설치와 HTTPS가 자동으로 잘 동작하도록 준비되어 있습니다.

## 0. 시작 전에 준비할 것
- Railway에서 백엔드를 먼저 배포하거나, 최소한 배포 예정 URL을 정해두기
- 최종적으로 Vercel 환경변수 `VITE_API_URL` 에 Railway 백엔드 URL 입력
- 예시: `https://freshtable-api.up.railway.app`

## 1. 가장 쉬운 방법: GitHub 연결 배포

### 1-1. Vercel 가입 또는 로그인
- https://vercel.com 접속
- `Continue with GitHub` 버튼으로 로그인
- 처음이라면 권한 허용

### 1-2. 새 프로젝트 만들기
- 대시보드 오른쪽 위 `Add New` → `Project`
- GitHub 저장소 목록에서 FreshTable 저장소 선택
- 저장소가 없다면 먼저 ZIP을 풀고 GitHub에 업로드한 뒤 다시 돌아오기

### 1-3. 빌드 설정 입력
아래처럼 설정하면 됩니다.

- Root Directory: `/`
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm --workspace client run build`
- Output Directory: `client/dist`

화면에서 보이는 위치:
- 저장소 선택 후 `Configure Project` 화면
- `Build and Output Settings` 섹션을 펼쳐서 입력

### 1-4. 환경변수 추가
`Environment Variables` 섹션에서 아래를 추가합니다.

- Name: `VITE_API_URL`
- Value: Railway 백엔드 공개 URL

예시:

```bash
VITE_API_URL=https://freshtable-api.up.railway.app
```

### 1-5. Deploy 클릭
- `Deploy` 버튼 클릭
- 배포가 끝나면 `https://프로젝트명.vercel.app` 주소가 발급됩니다.

## 2. GitHub 없이 배포하는 방법

Vercel은 초보자 기준으로는 GitHub 연결이 가장 쉽지만, GitHub 없이도 가능합니다. ZIP 파일을 그대로 웹에 올리는 방식보다, **ZIP을 푼 폴더를 Vercel CLI로 배포하는 방법**이 가장 현실적이고 안정적입니다.

### 2-1. ZIP 압축 해제
```bash
unzip FreshTable-deploy-ready.zip
cd freshtable_pwa
```

### 2-2. Vercel CLI 설치
```bash
npm i -g vercel
```

### 2-3. 로그인
```bash
vercel login
```

### 2-4. 프론트엔드 환경변수 추가
Vercel 대시보드에서 프로젝트를 만든 뒤 `Settings` → `Environment Variables` 에서 `VITE_API_URL` 을 추가하거나, CLI 질문 과정에서 프로젝트를 연결한 뒤 대시보드에서 넣으면 됩니다.

### 2-5. 배포 실행
프로젝트 루트에서 아래처럼 실행합니다.

```bash
vercel
```

프로덕션으로 바로 올리고 싶다면:

```bash
vercel --prod
```

## 3. 배포 후 꼭 확인할 것
- 첫 화면이 열리는지
- `/meal-diary`, `/recipes`, `/statistics` 같은 직접 URL 진입이 되는지
- 대시보드 상단 `앱 설치하기` 버튼이 보이는지
- 브라우저 주소창에 자물쇠(HTTPS)가 보이는지
- API 요청이 Railway URL로 가는지

## 4. 자주 막히는 문제

### 문제 1. 빈 화면만 보여요
원인:
- `VITE_API_URL` 값 누락
- 잘못된 Output Directory
- SPA 라우팅 미설정

확인:
- `client/dist` 로 출력되는지
- `vercel.json` 이 루트에 있는지
- 환경변수 저장 후 재배포했는지

### 문제 2. API 호출이 실패해요
원인:
- Railway 백엔드 URL이 틀렸거나 아직 공개 도메인이 없음
- Railway 쪽 CORS_ORIGIN 값이 Vercel 주소와 다름

### 문제 3. 설치 버튼이 안 떠요
원인:
- HTTPS가 아닌 환경에서 접속
- PWA가 아직 캐시되기 전
- iPhone Safari는 설치 방식이 다름

해결:
- iPhone에서는 `공유` → `홈 화면에 추가`
- Android Chrome에서는 설치 프롬프트 또는 주소창 설치 아이콘 확인

## 5. 초보자용 한 줄 요약
1. Railway 백엔드 배포
2. 백엔드 URL 복사
3. Vercel 프로젝트 생성
4. `VITE_API_URL` 추가
5. Deploy 클릭
6. 발급된 Vercel 주소를 Railway의 `CORS_ORIGIN`에 다시 입력
7. 다시 Redeploy
