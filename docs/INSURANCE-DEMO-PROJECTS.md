# 보험사 데모 프로젝트 등록

## 실행
프로젝트 폴더에서 최신 main을 받은 후 실행합니다. 기존 .env의 DATABASE_URL 및 STORAGE_ROOT를 사용합니다.

```powershell
git pull origin main
node scripts/seed-insurance-demo.mjs --apply
```

서버와 브라우저 로그인은 필요하지 않으며 서버를 켜둬도 됩니다.
보험 템플릿은 seed-insurance-templates.mjs --apply로 먼저 등록되어 있어야 합니다.
실행 중인 서버와 같은 프로젝트 폴더·환경설정에서 실행해야 파일을 조회할 수 있습니다.

## 구성
| 프로젝트 | 템플릿 | 현재 단계 | 지연 Task | 등록 문서 | 리비전 파일 |
|---|---|---|---:|---:|---:|
| 간병인 보험상품 개발 | 신규 보험상품 개발 | G4 | 2 | 14 | 20 |
| 암보험 개선 프로젝트 | 손해보험 업무 개선 | G5 | 1 | 18 | 24 |

- PM: 대상 회사의 dean@jsolution.io 또는 dean@jjjsolution.com 계정. 정확히 하나만 있어야 합니다.
- 시작일: 실행 기준일 10일 전. 기준일 기본값은 한국 날짜이며 INSURANCE_DEMO_DATE=2026-10-18로 고정할 수 있습니다.
- 짧은 데모 기간에 맞춰 실행 업무를 병행하는 일정으로 구성합니다. 완료·진행 실적, 시작 Baseline, Gate 승인, 이슈·협조 요청 포함.
- 유형: 신규 보험상품 개발 / 손해보험 업무 개선. 기존 유형이 없으면 추가합니다.
- 회사가 여러 개면 PMS_COMPANY_ID로 대상 회사를 지정합니다.
- 거래처는 농협손해보험 (가상 데모)로 표시합니다. 실제 회사 내부 자료·승인·상품 조건이 아닙니다.
- 기존 제조 프로젝트는 수정하지 않습니다. 동일 데모 코드가 있으면 해당 프로젝트 전체를 유지합니다.

## 리비전 비교
각 프로젝트의 핵심 문서 3종에 Rev.01~03이 있습니다. Rev.02와 Rev.03은 이전 내용을 유지하면서 검토 항목·절차·확인 기준을 본문에 누적 추가합니다.

간병인보험: G2-A01 상품 개발 요건 정의서, G3-A01 약관·상품설명서 초안, G4-A02 상품 안내자료·업무 매뉴얼.
암보험 개선: G2-A01 현행 업무 분석서, G3-A02 개정 업무 지침·표준 서식 초안, G5-A01 개선 전후 성과 비교표.

문서와 각 리비전의 변경 사유, 파일 크기, 작성일, 등록자를 저장하고 기존 문서 미리보기·AI 비교에서 읽을 수 있는 텍스트 캐시도 함께 생성합니다.

## 사용자 도메인 변경
기본 실행은 대상 회사 사용자 전체의 이메일 끝 @jjjsolution.com을 @jsolution.io로 변경합니다.
이름에 jjjsolution.com이 포함된 경우 해당 부분도 바꿉니다. 실제 사람 이름과 사용자 PK는 유지합니다.
다른 회사 사용자와 충돌하는 로그인 이메일이 생기면 병합하지 않고 등록을 취소합니다.
데모 계정 생성 스크립트도 새 도메인을 사용합니다.
기존 로그인 세션은 다시 로그인해야 할 수 있습니다. Dean 로그인: dean@jsolution.io. 기존 비밀번호는 바뀌지 않습니다.
--keep-user-domain 옵션은 사용자 도메인 변경을 생략합니다.

## 검증·문서만 생성
```powershell
node scripts/seed-insurance-demo.mjs
node scripts/seed-insurance-demo.mjs --documents-only
node --test tests/insurance-demo-projects.test.mjs tests/portfolio-project-filter.test.mjs
```

--documents-only는 DB를 변경하지 않고 .demo-generated/insurance-g6에 DOCX와 manifest를 만듭니다.
등록은 Drizzle/PostgreSQL 트랜잭션으로 수행하며 실패 시 새로 기록한 Storage 파일을 정리합니다.
완료 후 템플릿/프로젝트/사용자 화면을 새로고침하고 전사 대시보드에서 프로젝트 유형을 선택합니다.
프로젝트 유형·거래처 필터는 교집합으로 적용되며, 대시보드 카드에서 목록으로 이동할 때 유형 선택도 전달됩니다.
