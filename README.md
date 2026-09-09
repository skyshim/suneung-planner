# 수능 D-70 학습 플래너

고3 수능(2026-11-19) **D-70(2026-09-10) ~ D-10(2026-11-09)** 계획을 관리하는 개인용 모바일 우선 PWA.
기존 Notion DB "수능 학습 기록"의 **471행을 그대로** 시드로 가져와, 첫 기동 시 자동으로 채웁니다.

---

## 🚀 내가 할 일 — 딱 3단계

### 1) GitHub에 저장소 만들고 push

```bash
# 이 폴더에서 (이미 git init + 커밋까지 끝나 있음)
gh repo create suneung-planner --private --source=. --push
```

`gh` CLI가 없다면 → [github.com/new](https://github.com/new) 에서 **suneung-planner** 저장소를 만든 뒤:

```bash
git remote add origin https://github.com/<내-깃허브-아이디>/suneung-planner.git
git branch -M main
git push -u origin main
```

### 2) Render에 원클릭 배포

아래 링크의 `<내-깃허브-아이디>` 만 바꿔서 브라우저로 열기 → **GitHub 연동 → Apply** 클릭.

```
https://render.com/deploy?repo=https://github.com/<내-깃허브-아이디>/suneung-planner
```

> `render.yaml`(Blueprint)이 **웹 서비스 + PostgreSQL**을 한 번에 만듭니다. 추가 설정 없음.
> 첫 배포는 3~5분. 배포가 끝나면 앱이 켜지면서 471행을 **자동 시딩**합니다.

### 3) 휴대폰 홈 화면에 추가

배포 후 나온 URL(`https://suneung-planner-xxxx.onrender.com`)을 폰에서 열고,

- **iPhone (Safari)**: 공유 버튼 → *홈 화면에 추가*
- **Android (Chrome)**: 우측 상단 ⋮ → *홈 화면에 추가* / *앱 설치*

---

## ⚠️ 무료 티어에서 꼭 알아둘 것 2가지

1. **무료 PostgreSQL은 생성 후 30일이 지나면 만료됩니다.** 계획 기간은 70일이라 중간에 한 번 만료돼요.
   → 앱의 **규칙 탭 → 데이터 백업/복원**에서 매주 한 번 백업 파일을 내려받아 두세요.
   만료되면 Render에서 무료 DB를 새로 만들고(기존 것 삭제 후), 같은 화면에서 **백업에서 복원**하면 그대로 돌아옵니다.
   (만료 없이 쓰려면 Neon·Supabase 등의 무료 Postgres 접속 문자열을 Render 환경변수 `DATABASE_URL`에 넣으면 됩니다.)
2. **무료 웹 서비스는 15분간 접속이 없으면 잠자기 상태**가 됩니다. 아침에 처음 열 때 30초~1분 정도 로딩이 걸릴 수 있어요.

---

## 화면

| 탭 | 하는 일 |
|---|---|
| **오늘** | D-N, 오늘 할 일 목록, **밀린 것**(어제 이전 미완료) 상단 노출, 항목 상한 90% 임박 배지, 항목 추가 |
| **저녁체크** | 하루 전체를 한 화면에서 체크 + 실제(분)/카운트 입력 → **한 번에 저장**, 미완료 일괄 이월 |
| **캘린더** | 월/주 전환, 날짜별 완료/계획 요약, 누르면 그날 상세로 이동 |
| **현황 → 항목별** | 항목별 완료횟수/상한 진행률, 전환 규칙(예: 일당백→크럭스) 표시 |
| **현황 → 과목별** | 과목별 계획 대비 실제 막대 + 누적 학습시간 추이 차트 |
| **규칙** | 운영 규칙·마인드셋 고정 표시, 항목 전환 규칙, 데이터 백업/복원 |

- 모든 체크박스/숫자는 **입력 즉시 자동 저장**(400ms 디바운스, 저장 버튼 없음)
- 다크/라이트 모드 자동 대응, 색상 팔레트는 색각 이상 대비 기준을 통과하도록 검증됨

---

## 기술 스택

- **Backend: FastAPI(Python)** — 시드 JSON 처리와 날짜/집계 로직이 파이썬 쪽이 짧고, 정적 파일 서빙까지 한 프로세스로 끝나 Render 무료 인스턴스 1개로 충분하기 때문에 선택.
- **DB**: PostgreSQL (Render 무료). `DATABASE_URL`이 없으면 로컬 SQLite(`backend/planner.db`)로 동작.
- **Frontend**: React 18 + Tailwind CSS + Vite, PWA(manifest + 서비스워커).
  빌드 결과물(`backend/static/`)을 **저장소에 커밋해 두었기 때문에** Render 빌드는 `pip install`만 하면 됩니다.

---

## 데이터 구조

### `backend/app/data/seed_plan.json`
Notion "수능 학습 기록" DB에서 그대로 가져온 471행. 앱 최초 기동 시 `tasks` 테이블이 비어 있으면 자동 삽입됩니다.

### `backend/app/data/item_master.json` — 규칙을 바꿀 때 **여기만** 고치세요
항목별 과목/유형/회당 분량/목표(분)/**상한 횟수**/전환 항목(`next`)/짝 항목(`pair`), 그리고 운영 규칙·마인드셋 문구가 모두 여기에 있습니다.

```jsonc
{ "name": "일당백", "subject": "물리", "minutes": 30, "goal": 540, "cap": 18, "next": "크럭스" }
```

주요 상한/전환:

| 항목 | 상한 | 도달 후 |
|---|---|---|
| 심찬우 기테마 인강 | 34회 / 3400분 | 대기(자유시간) |
| 이감 간쓸개 | 60회 (40분) | — |
| 언매N제 | 25회 (20분) | — |
| 영어마더텅 | 30회 (20분) | — |
| 어나클 ↔ 화학마더텅 | 각 40회 (90분 / 40분) | 항상 짝으로 진행 |
| 샤인미 | 45회 (90분) | 이해원 트렌드 (60분/600목표) |
| 일당백 | 18회 (30분) | 크럭스 (40분, 18회) |
| 라피스 모고 | 4회 (60분) | 25서바 (50분, 1250목표) |
| 베라디 모고 | 6회 (60분) | 26서바 (60분, 1500목표) |
| 설맞이 모고 | 6회 (150분) | 이해원 모고 (120분, 1680목표) |
| 이감 모고 | 5회 (120분) | 강은양 모고 (120분, 8회) |
| 69모 | D-25부터 매일, 120분 / 1800목표 | — |
| 모의고사 오답 정리 | 12회 (120분) | — |

> 심찬우 찬우화 / 문상변은 직접 채우는 항목이라 자동 생성 대상에서 제외돼 있습니다(앱에서 수동 추가 가능).

---

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/meta` | 수능일, D-N, 항목 마스터, 운영 규칙 |
| GET | `/api/day/{date}` | 그날 항목 + 밀린 것 + 항목별 누적 진행 |
| GET | `/api/range?start&end` | 캘린더용 날짜별 요약 |
| PATCH | `/api/tasks/{id}` | 부분 수정(자동 저장) |
| POST | `/api/tasks` · DELETE `/api/tasks/{id}` | 항목 추가 / 삭제 |
| POST | `/api/day/{date}/bulk` | 저녁 일괄 저장 |
| POST | `/api/carry` | 미완료 이월 (`{ids, to}`) |
| GET | `/api/stats/items` · `/api/stats/subjects` | 대시보드 집계 |
| GET | `/api/export` · POST `/api/import` | 백업 / 복원 |

API 문서: `https://<배포주소>/api/docs`

---

## 로컬 실행

```bash
# 백엔드 (SQLite 자동 사용)
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8100

# 프론트엔드 (개발 서버, /api는 8100으로 프록시)
cd frontend && npm install && npm run dev

# 프론트엔드 수정 후에는 반드시 빌드해서 커밋해야 배포에 반영됩니다
cd frontend && npm run build   # -> backend/static/
```

DB를 처음부터 다시 채우려면 `backend/planner.db`를 지우고 재기동하면 됩니다.
