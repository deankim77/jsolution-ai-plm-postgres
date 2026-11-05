# 첨부 오피스 문서 PDF 미리보기

## 처리 흐름

원본 저장과 Revision 등록이 끝나면 PostgreSQL 작업 큐에 변환 요청만 기록하고 업로드 응답을 반환한다. 업로드 요청에서 LibreOffice를 실행하거나 PDF 변환을 기다리지 않는다. 큐 등록에 실패해도 원본 첨부는 유지하고 미리보기 생성 실패 상태를 기록한다.

별도 워커가 Word/Excel/PowerPoint(`doc/docx/xls/xlsx/ppt/pptx`)를 LibreOffice headless로 변환하고 Storage Adapter에 PDF를 보관한다. 원본 다운로드는 계속 원본 파일을 반환한다. PDF·이미지·텍스트 및 AI 생성 결과 처리는 유지한다.

첨부 문서의 네 가지 미리보기 구현은 공통 `OfficeDocumentPreview`를 사용한다. 같은 Revision의 서버 상태를 3초 간격으로 확인하고 완료되면 PDF로 전환한다. 실패 시 재시도와 원본 다운로드를 제공한다. 창을 닫거나 Revision을 전환하면 조회를 취소한다. 미리보기 상태와 실패 응답은 캐시하지 않는다.

## 서버 적용

1. 웹과 워커가 사용하는 서버에 LibreOffice와 고객 문서의 글꼴을 설치한다. 웹과 워커를 분리할 때는 워커 서버에 설치한다.
2. 프로젝트 `.env`에 기존 `DATABASE_URL`, `STORAGE_PROVIDER`, `STORAGE_ROOT`와 LibreOffice 경로를 설정한다. 웹과 워커는 같은 DB와 같은 원본 저장소에 접근해야 한다. 상대 `STORAGE_ROOT`를 쓴다면 두 프로세스의 작업 디렉터리를 프로젝트 루트로 맞춘다.

```dotenv
# Windows 예시
LIBREOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.com"
# Linux 예시: LIBREOFFICE_PATH=/usr/bin/soffice
```

3. 프로젝트 루트에서 마이그레이션을 적용한다.

```powershell
npm run db:migrate
```

4. 웹 서버를 새 코드로 재시작하고 별도 상주 프로세스로 워커를 실행한다. Node.js 22.13 이상을 사용한다.

```powershell
npm run office:worker
```

서버매니저 또는 운영 서비스에 워커를 등록하고 자동 시작·실패 시 재시작을 설정한다. 워커를 시작하지 않으면 원본 첨부는 가능하지만 PDF는 준비 중 상태로 남는다. 이 워커는 웹 프로세스의 수명에 의존하지 않는다.

## 상태와 복구

| conversion_status | 의미 |
|---|---|
| office_pdf_pending | 작업 대기 |
| office_pdf_converting | 변환 중 |
| office_pdf_ready | PDF 준비 완료 |
| office_pdf_failed | 변환 실패, 재시도 가능 |

상태는 기존 `deliverable_versions` 메타데이터를 사용하고, 작업 큐는 `office_preview_jobs`에 보관한다. DWG의 기존 변환 상태값과 구분한다. 기존 `office_text_cached` 문서는 최초 미리보기 때 PDF 작업을 등록한다. 완료된 PDF는 반복 변환하지 않는다.

여러 워커가 실행돼도 `FOR UPDATE SKIP LOCKED`로 같은 작업을 동시에 가져가지 않는다. 작업 임대는 5분이며 중단된 작업은 최대 3회까지 회수한다. 이전 임대의 작업 결과는 새 결과를 덮어쓰지 않는다. 삭제된 Revision의 결과도 연결하지 않는다. 실패한 작업은 사용자가 재시도할 수 있다.

변환은 작업마다 분리된 임시 디렉터리와 LibreOffice 프로필을 사용한다. 기본 제한은 원본·결과 각 100MiB, 변환 120초이며 워커는 한 번에 한 건씩 처리한다. 암호화·손상 문서나 제한 초과는 실패 처리하고 원본을 보존한다. 매크로는 실행하지 않도록 전용 프로필을 설정한다. 운영 시 워커 계정은 필요한 DB·저장소 권한만 갖도록 구성한다.

## 검증

```powershell
npm run test:office-preview
node --test tests/office-preview-integration.test.mjs
```

통합 테스트는 전용 `OFFICE_PREVIEW_TEST_DATABASE_URL` 및 `OFFICE_PREVIEW_TEST_LIBREOFFICE=1`이 있을 때 실행한다. 임시 DB 스키마를 만들고 삭제한다. 일반 운영 DB 연결변수를 테스트용으로 재사용하지 않는다. CI는 PostgreSQL 16 및 LibreOffice로 동시 작업·임대 복구와 실제 DOCX/XLSX/PPTX 변환을 확인한다.

실제 고객 문서의 표·차트·글꼴·Excel 인쇄 영역은 운영 전 별도로 확인한다. PDF는 정적 읽기 전용이며 PPT 애니메이션이나 Excel 편집을 제공하지 않는다.
