# 사용 기능 설정

시스템 설정 → 사용 기능 설정에서 회사별로 다음 다섯 기능의 노출을 관리합니다.

- 설계변경: 전용 메뉴, 목록/등록 화면, 고정 탭, 통합검색 분류
- 품질관리: 전용 메뉴, 목록/등록 화면, 고정 탭, 통합검색 분류
- PART·BOM: 전용 메뉴, BOM 비교/편집 화면, WBS BOM 탭
- 도면관리: 문서·산출물의 도면 탭/등록, WBS 도면 탭 및 관련 목록
- 원가관리: 전용 메뉴와 원가관리 화면

설계변경·품질관리·PART·BOM은 좌측 PLM 그룹에 표시합니다.
원가관리는 프로젝트 업무 그룹에 유지합니다.
기능을 꺼도 업무 데이터와 워크플로우 유형·양식·처리 API는 삭제하거나 중지하지 않습니다.
이 설정은 제품 UI 노출 정책이며 사용자별 데이터 보안 권한을 대체하지 않습니다.

기존 system_settings 테이블의 FEATURE_SETTINGS 키를 사용하므로 신규 DB 스키마 변경은 없습니다.
미설정 회사는 다섯 기능 모두 사용합니다. 사용 여부는 Boolean 다섯 항목을 한 번에 저장합니다.
관리자(ADMIN, SUPER_ADMIN, SYSTEM_ADMIN)만 저장할 수 있습니다.
설정 저장과 감사 이력은 하나의 PostgreSQL 트랜잭션으로 기록합니다.
화면은 초기 조회 중 또는 조회 실패 시 선택 기능을 표시하지 않습니다.
저장 후 현재 화면에 즉시 반영하고, 다른 브라우저 창은 포커스를 되찾을 때 재조회합니다.

검증:
- node --test tests/feature-settings.test.mjs tests/feature-settings-render.test.mjs
- npm run check:architecture
- npm run check:v2-ui
- npm run audit:react-dom

실제 서버 DB 연결과 브라우저에서 저장 → 새로고침 → 재활성화 확인은 별도로 필요합니다.
