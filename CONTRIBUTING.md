# 팝업 등록·수정 기준

이슈로 제보할 때 행사명, 지점, 공식 공지 URL, 행사 날짜, 예약 오픈·마감의 근거를 함께 적어 주세요. 개인정보나 본인의 예약 내역은 올리지 마세요.

1. 같은 브랜드라도 지역·지점·개최 기간이 다르면 별도 레코드를 사용합니다.
2. 공식 주최·브랜드·행사장·예약처를 출처로 우선합니다. 2차 출처만 있으면 `verification: secondary`로 표시합니다.
3. `booking.mode`는 `reservation`(예약제 확인), `mixed`(예약·현장 병행 확인), `walk-in`(공식적으로 현장 방문 확인), `unknown`(확인되지 않음) 중 하나입니다. 공지에 예약 언급이 없다는 이유로 `walk-in`을 사용하지 않습니다.
4. `booking.open/close`는 접수 시작/마감입니다. `booking.visitStart/visitEnd`는 예약으로 방문 가능한 날짜입니다. `event.start/end`와 서로 바꾸지 않습니다.
5. 날짜만 공개되면 `YYYY-MM-DD`, 시각까지 공개되면 `YYYY-MM-DDTHH:mm:ss+09:00`을 사용합니다. 시각을 임의로 23:59로 만들지 않습니다. 미확인 값은 `null`입니다.
6. 접수 오픈·마감 값이 있다면 `openSource/closeSource`로 공식 근거를 연결합니다. 잘못된 자동 추출을 막기 위해 `npm run validate`가 이를 요구합니다.
7. 취소된 행사는 삭제 대신 `cancelled: true`와 출처·메모를 추가합니다. 종료된 기록도 남깁니다.
8. `checkedAt`은 해당 항목을 실제 확인한 날입니다. 자동 HTTP 응답 성공을 사람이 내용을 검증한 날짜로 바꾸지 않습니다.
9. `sources[].note`에 그 링크로 확인한 사실과 확인하지 못한 사실을 짧게 기록합니다.
10. `category`는 팝업의 주력 상품·내용을 기준으로 `미용`(화장품·스킨케어), `의류`, `향수`, `푸드`, `리빙`(가구·생활용품·공예), `캐릭터·게임`, `음악·엔터` 중에서 선택합니다. 향수는 미용과 구분하며, 행사 이름에 향이 들어가더라도 아티스트 중심 행사라면 음악·엔터로 분류합니다. 대응하는 `tone`은 각각 `beauty`, `fashion`, `fragrance`, `food`, `lifestyle`, `character`, `lifestyle`입니다.

11. `city`는 `서울`, `경기`, `인천` 중 하나이며 `district`는 실제 자치구/시, `region`은 동네입니다. 서울 자치구는 `docs/data/coverage.json`의 목록을 사용합니다. 브랜드의 지점명과 실제 행정구역이 다르면 위치를 기준으로 합니다. 예: 신세계 강남점 → 서울 / 서초구 / 반포·서초.

변경 후 `npm run validate`와 `npm test`를 실행합니다. GitHub Actions가 `main`의 `docs/`를 Pages 아티팩트로 게시합니다. 자동 수집기의 `collection` 표시가 있는 행사를 수동 검증으로 전환하려면 근거를 확인하고 `collection` 필드를 제거합니다. 비밀번호, API 키, 원문 광고 이미지, 사용자 예약 개인정보를 저장소에 넣지 않습니다.

공개 모음 수집의 collection.method는 public-listing이며 verification은 secondary입니다. 분류 근거가 없으면 기타로 남깁니다. 공식 SNS 일치 검증은 official-social-match로 표시합니다. 예약 접수 마감은 SNS 자동 날짜 비교와 별개의 공식 근거가 필요합니다. 검토 후보는 docs/data/discovery.json에 보존하고 사이트의 SNS·발견 공지 화면에서 확인합니다.
