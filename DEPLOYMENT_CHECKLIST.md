# FreshTable 배포 후 체크리스트

## 배포 전
- [ ] Railway 백엔드 서비스 생성
- [ ] Railway PostgreSQL 추가
- [ ] Railway 공개 도메인 생성
- [ ] Vercel 프로젝트 생성
- [ ] `VITE_API_URL` 입력
- [ ] `CORS_ORIGIN` 입력

## 백엔드 확인
- [ ] `https://백엔드도메인/health` 접속 시 `{ "ok": true }` 또는 `ok:true` 응답 확인
- [ ] Railway 로그에 Prisma 연결 오류 없음
- [ ] Railway 로그에 CORS 오류 없음
- [ ] 첫 배포 후 `migrate:deploy` 실행 확인

## 프론트엔드 확인
- [ ] Vercel 첫 화면 정상 표시
- [ ] `/meal-diary` 직접 접속 정상
- [ ] `/recipes` 직접 접속 정상
- [ ] `/statistics` 직접 접속 정상
- [ ] 대시보드 데이터가 실제 API에서 로딩됨

## PWA 확인
- [ ] HTTPS 자물쇠 표시
- [ ] `앱 설치하기` 버튼 표시 또는 브라우저 설치 메뉴 확인
- [ ] Android Chrome에서 설치 가능
- [ ] iPhone Safari에서 `홈 화면에 추가` 가능
- [ ] 홈 화면 아이콘 정상 표시
- [ ] standalone 앱처럼 실행됨

## 기능 확인
- [ ] 영수증 OCR 업로드 화면 열림
- [ ] 구매 저장 후 대시보드 금액 반영
- [ ] 식재료 상세에서 사용 내역 추가 가능
- [ ] 식단 일기 저장 가능
- [ ] 장보기 리스트 자동 생성 동작
- [ ] 레시피 추천 화면 정상 표시
- [ ] 통계 차트 표시

## 최종 모바일 테스트
- [ ] 내 핸드폰 브라우저로 접속
- [ ] 홈 화면에 설치
- [ ] 앱 실행 후 로그인 없이 기본 샘플 데이터 확인
- [ ] 오프라인 상태에서 기본 화면 확인
