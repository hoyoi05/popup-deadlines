# 팝업 데드라인

[사이트 열기](https://hoyoi05.github.io/popup-deadlines/)

서울·수도권 브랜드 팝업의 예약 오픈, 예약 마감, 행사 시작·종료를 구분해 보여주는 GitHub Pages 사이트입니다. [SEC Deadlines](https://hoyoi05.github.io/sec-deadlines/)의 마감 중심 구성을 참고해 새로 작성했습니다. 원본 코드나 브랜드 광고 이미지는 복제하지 않았습니다.

현재 등록된 행사는 2026-09-15에 확인한 실제 행사 8건입니다. 신규 행사는 자동 수집하지 않습니다. 공식 예약처의 잔여석·매진 상태도 실시간 연동하지 않습니다. 모든 행사에 확인일과 출처를 표시하고, 오래된 자료에는 재확인 안내가 나옵니다.

## 기능

- 한국 표준시(KST) 실시간 카운트다운, 날짜 단위 일정의 D-day 표시
- 지역·분야 필터, 여러 검색어 동시 검색, 일정 정렬 및 URL 상태 유지
- 진행·예정 / 예약 일정 / 종료된 팝업 보기
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

별도의 패키지 설치가 필요하지 않습니다. Node.js 22 이상에서 실행합니다.

## 로컬 실행 및 배포

```sh
npm start
```

미리보기: `http://127.0.0.1:4173/popup-deadlines/`

GitHub 저장소 Settings → Pages → Deploy from a branch → `main` / `/docs`로 배포합니다. `.nojekyll`이 있으며 HTML/CSS/JavaScript와 JSON만 사용하는 정적 사이트라 빌드·서버·API 키가 필요하지 않습니다. 모든 내부 경로는 저장소 하위 URL에서도 작동하는 상대 경로입니다.

## 구조

```text
docs/index.html          화면 구조
docs/assets/style.css    반응형 디자인
docs/assets/app.js       검색·필터·렌더링
docs/assets/core.js      날짜·상태 판정
docs/data/popups.json    행사 데이터
scripts/validate.mjs     데이터·출처·자산 검증
tests/core.test.mjs      날짜 경계와 검색·정렬 테스트
```

## 운영 범위

현재 초기 조사는 성수·여의도·한남과 수원을 포함합니다. 홍대·잠실·판교·하남·인천은 이후 공식 일정이 확보되면 추가할 수 있습니다. 이 사이트의 행사 상태는 시간 계산 결과이며 현장 운영·잔여석을 보장하지 않습니다. 날짜만 공개된 행사는 KST 날짜가 바뀔 때 종료 목록으로 이동하며, 이 계산은 해당 날짜의 영업 종료 시각을 뜻하지 않습니다.

향후 자동화는 공개된 브랜드 공지의 변경·새 링크 탐지 → 검토 대기 → 공식 근거 확인 → 데이터 반영 순서로 확장하는 것이 좋습니다. 회차 방문일·일일 입장 마감·굿즈 예약판매·채용 지원 마감이 방문 예약 마감으로 잘못 들어가지 않도록 사람이 검토해야 합니다.

코드: MIT License. 브랜드명과 연결된 외부 콘텐츠의 권리는 각 권리자에게 있습니다.
