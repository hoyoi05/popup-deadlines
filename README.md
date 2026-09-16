# 팝업 데드라인

[사이트 열기](https://hoyoi05.github.io/popup-deadlines/)

서울·수도권 브랜드 팝업의 예약 오픈, 예약 마감, 행사 시작·종료를 구분해 보여주는 GitHub Pages 사이트입니다. [SEC Deadlines](https://hoyoi05.github.io/sec-deadlines/)의 마감 중심 구성을 참고해 새로 작성했습니다. 원본 코드나 브랜드 광고 이미지는 복제하지 않았습니다.

공식 공지로 검증한 초기 일정에 공개 모음·SNS에서 발견한 일정을 추가합니다. GitHub Actions가 매일 오전 9시(KST)에 공식 공지, 팝플리·팝가·성수 팝업 네비·POP-SPOT, 블로그 RSS와 연결된 Instagram·X·Threads 공개 본문을 확인하고 Pages에 배포합니다. 컴퓨터가 꺼져 있어도 실행됩니다. 모음 일정은 공식 확인 전으로 표시하며, SNS 본문을 읽었다는 사실만으로 공식 계정으로 간주하지 않습니다. [SNS·발견 공지 화면](https://hoyoi05.github.io/popup-deadlines/discover.html)에서 충돌·중복·검토 대기를 검색할 수 있습니다.

## 기능

- 한국 표준시(KST) 실시간 카운트다운, 날짜 단위 일정의 D-day 표시
- 서울 전체·25개 자치구·경기/인천 선택, 동네와 카테고리 조합 필터(미용, 의류, 향수, 푸드, 리빙, 캐릭터·게임, 음악·엔터), 여러 검색어 동시 검색, 일정 정렬 및 URL 상태 유지
- 진행·예정 / 예약 일정 / 종료된 팝업 보기, 공식 확인 수준 필터
- 행사 종료까지 / 행사 시작까지를 별도 구역으로 표시하고 건수와 바로가기를 제공합니다. 예약 오픈·마감과 날짜 미공개 항목도 구분하며, 검색·필터·정렬은 각 구역에 함께 적용됩니다.
- 예약 상세, 공식 공지 및 예약 링크, 출처별 확인 근거
- 모바일 화면, 키보드 탐색, 빈 결과·로딩 실패 처리

## 일정 수정

GitHub에서 [`docs/data/popups.json`](docs/data/popups.json)을 편집하고 `main`에 커밋하면 GitHub Pages가 자동 배포합니다. 화면 코드를 수정할 필요가 없습니다. [조사 기록](RESEARCH.md)과 [등록 기준](CONTRIBUTING.md)을 참고하세요.

1. 브랜드 공식 공지나 공식 예약 페이지를 확인합니다.
2. `event.start/end`는 행사 기간, `booking.open/close`는 예약 접수 기간에 입력합니다.
3. 시각이 확인되면 `2026-09-20T20:00:00+09:00`, 날짜만 확인되면 `2026-09-20`을 사용합니다. 미공개 값은 `null`입니다.
4. `booking.open` 또는 `close`에 값을 넣으면 `openSource` 또는 `closeSource`에 해당 시각을 확인한 공식 출처 URL을 넣습니다. 같은 URL이 `sources`의 `kind: official`에도 있어야 합니다.
5. 변경한 항목의 `checkedAt`을 갱신하고, 데이터 전체의 `checkedAt`은 가장 최근 조사일로 유지합니다. 전체 날짜만 바꿔 오래된 행사가 새로 검증된 것처럼 보이게 하지 않습니다.
6. 아래 검증을 통과시킨 뒤 커밋합니다.

```sh
npm run validate
npm test
```

수집기는 Node.js 22.12 이상과 Cheerio를 사용합니다. 처음 실행할 때 `npm ci --ignore-scripts`로 고정 버전 의존성을 설치합니다. 게시되는 사이트는 정적 파일만 사용합니다.

## 로컬 실행 및 배포

```sh
npm ci --ignore-scripts
npm start
```

미리보기: `http://127.0.0.1:4173/popup-deadlines/`

GitHub 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정합니다. Actions → **Update popups and deploy Pages** → **Run workflow**로 수동 갱신할 수 있습니다. 워크플로는 매일 오전 9시(KST) 실행되며 수집·검사·커밋·배포를 함께 수행합니다. 소스 수정 push는 수집 없이 검사·배포합니다. 필요한 권한은 데이터 커밋(contents: write), Pages 배포(pages: write, id-token: write)이며 별도 API 키는 필요하지 않습니다.

## 구조

```text
docs/index.html          일정 화면
docs/discover.html       SNS·발견 공지 검색
docs/assets/discover.js  후보·출처·충돌·수집 대기 렌더링
docs/assets/style.css    반응형 디자인
docs/assets/app.js       검색·필터·렌더링
docs/assets/core.js      날짜·상태 판정
docs/data/popups.json    행사 데이터
docs/data/coverage.json  서울 25개 구·조사 검색어·출처 목록
MONITORING.md           자동 수집 범위와 검토 절차
scripts/collect.mjs      공식 공지 수집·변경 감지
scripts/collect-wide.mjs 공개 모음·연결된 SNS 수집
scripts/wide-lib.mjs     JSON-LD·일정 필드·공개 SNS 파서
data/wide-sources.json   확장 수집 대상·공식 계정 확인 근거
data/wide-state.json     페이지 확인 이력·SNS 본문 해시
scripts/collector-lib.mjs 공식 공지 파서
data/collector-sources.json 수집 대상
data/collector-state.json 원문 변경 감지 해시
docs/data/discovery.json 실행 상태와 검토 대기
.github/workflows/update-popups.yml 예약 실행·Pages 배포
scripts/validate.mjs     데이터·출처·자산 검증
tests/core.test.mjs      날짜 경계와 검색·정렬 테스트
```

## 운영 범위

조사 대상은 홍대·연남·합정을 포함한 서울 25개 구 전역과 수도권입니다. 현재 확정 기록은 홍대, 성수, 여의도, 한남·용산, 반포·서초와 수원을 포함합니다. 다른 자치구도 선택할 수 있으며, 0건은 등록된 일정이 없다는 뜻입니다. 신세계 강남점은 상호와 별개로 서초구에 분류합니다. 이 사이트의 행사 상태는 시간 계산 결과이며 현장 운영·잔여석을 보장하지 않습니다. 날짜만 공개된 행사는 KST 날짜가 바뀔 때 종료 목록으로 이동하며, 이 계산은 해당 날짜의 영업 종료 시각을 뜻하지 않습니다.

자동 작업은 지원 채널의 공개 공지 탐색 → 명시적 행사 기간 추출 → 데이터 수정 → 검사 → Pages 배포 순서로 진행합니다. 모음 사이트에서 행사명·명시적 연도·기간·서울 장소를 읽으면 secondary 일정으로 추가합니다. 날짜 충돌·유형 불명확·장소 미확인은 검토 대기에 남깁니다. SNS 발견은 공개 목록에 연결된 게시물 범위이며, 플랫폼 전체 키워드 검색이나 비공개 계정·스토리 수집은 지원하지 않습니다. 상세 절차, 실행 조건과 후보 기록은 [MONITORING.md](MONITORING.md)에 있습니다.

코드: MIT License. 브랜드명과 연결된 외부 콘텐츠의 권리는 각 권리자에게 있습니다.
