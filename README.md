# Demo Day 26 — Leaderboard

<img width="1546" height="859" alt="Screenshot 2026-07-22 at 12 11 39 PM" src="https://github.com/user-attachments/assets/b9888ecb-c2e6-4954-9133-e43cf5d776e3" />

<img width="1916" height="905" alt="Screenshot 2026-07-22 at 12 13 02 PM" src="https://github.com/user-attachments/assets/763e1be0-b3e0-49b9-af68-1dc2d116acb1" />


Live leaderboard for Demo Day that ranks projects by audience feedback collected via a Google Form.

Two deployment modes are available depending on your setup:

| Mode | Best for | Requires |
|---|---|---|
| **Apps Script** | Running inside Nutanix Google Workspace — no servers needed | Access to the Google Sheet |
| **Backend + Frontend** | Local machine, full control, manual CSV refresh | Python 3, Node.js |

---

## How it works

Voters submit feedback through a Google Form. Each submission captures:
- Demo ID (which project they're rating)
- Overall Rating (1–10)
- Strongest aspects (multi-select)
- Email address (used only for deduplication — never displayed)

**Ranking logic:**
1. **Deduplicate** — one vote per email per Demo ID (latest submission wins if someone re-submits)
2. **Bayesian average** — prevents a single 10/10 vote from outranking a project with 50 votes averaging 9.5
3. **Tiebreakers** (in order): raw avg score → avg aspects selected per voter → unique vote count
4. **Top 10** projects are displayed with floor badges (3rd / 7th / 8th floor by Demo ID range)

---

## Mode 1 — Google Apps Script (Recommended)

Runs entirely inside Google Workspace. No servers, no credentials, no dependencies. The script reads the Form responses sheet directly as the deploying user.

### Files

```
apps_script/
  Code2.gs    ← server-side logic (data processing, ranking)
  Index.html  ← leaderboard UI (dark theme, auto-refreshes every 30s)
```

> Use `Code2.gs` — it has the updated tiebreaker logic. `Code.gs` is an older version.

### Setup

**Step 1 — Open Apps Script from your Google Sheet**

Open the Form responses spreadsheet → **Extensions → Apps Script**

**Step 2 — Create the two files**

- Replace the default `Code.gs` content with everything from `apps_script/Code2.gs`
- Click **+** → **HTML file** → name it exactly `Index` → paste everything from `apps_script/Index.html`

**Step 3 — Set your sheet name**

At the top of `Code2.gs`, update line 3 to match your form responses tab name:
```js
var SHEET_NAME = "DemoDay2026";  // ← change this to your tab name
```

**Step 4 — Deploy**

- **Deploy → New deployment → Web app**
  - Execute as: **Me** (your Nutanix account)
  - Who has access: **Anyone** (safe — no PII is returned, only aggregated scores)
- Copy the deployment URL → open in any browser

**Step 5 — Update after code changes**

Any time you edit `Code2.gs` or `Index.html`, redeploy:
- **Deploy → Manage deployments → Edit → New version → Deploy**

### Floor badge mapping

| Demo ID range | Floor |
|---|---|
| 1 – 30 | 3rd Floor |
| 31 – 60 | 7th Floor |
| 61 – 100 | 8th Floor |

---

## Mode 2 — Local Backend + Frontend

FastAPI backend + React/Vite frontend running on your machine. Data is loaded from a local CSV file exported from Google Sheets.

### Requirements

- Python 3.9+
- Node.js 18+

### Install dependencies

```bash
# Backend
pip3 install -r backend/requirements.txt

# Frontend
cd frontend && npm install
```

### Start both servers

```bash
./start.sh
```

This starts:
- Backend API at `http://localhost:8000`
- Frontend at `http://localhost:5173`

To stop both, press `Ctrl+C`.

### Updating data

1. Open the Google Sheet → **File → Download → Comma Separated Values (.csv)**
2. Place the downloaded file at `backend/data/feedback.csv` (overwrite)
3. The leaderboard updates on the next 30-second auto-refresh

### API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/leaderboard` | Top 10 ranked projects |
| `GET /api/stats` | Total submissions, unique projects, unique voters |
| `GET /api/sync-status` | Data source mode and last update time |
| `GET /health` | Server health check |

### Data source modes

The backend supports two modes switched via the `DATA_SOURCE` environment variable:

```bash
# Default — reads from backend/data/feedback.csv
./start.sh

# Google Sheets mode (requires auth setup below)
DATA_SOURCE=google_sheets SPREADSHEET_ID=<your-sheet-id> ./start.sh
```

### Google Sheets mode setup (optional)

> **Note:** Requires a GCP OAuth2 client ID. If your organisation blocks external OAuth apps (e.g. Nutanix), use the Apps Script mode instead.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) (personal Gmail is fine)
2. Create a project → **APIs & Services → Enable → Google Sheets API**
3. **Credentials → Create → OAuth client ID → Desktop app** → download JSON → save as `backend/credentials.json`
4. **OAuth consent screen → Test users** → add your Nutanix email
5. Run the one-time auth flow (opens a browser — log in with your Nutanix account):
   ```bash
   python3 backend/auth_setup.py
   ```
6. Start with Google Sheets mode:
   ```bash
   DATA_SOURCE=google_sheets SPREADSHEET_ID=<id-from-sheet-url> ./start.sh
   ```

### File structure

```
DEMODAY26/
  apps_script/
    Code2.gs        ← Apps Script backend logic (use this)
    Code.gs         ← older version
    Index.html      ← Apps Script frontend UI
  backend/
    main.py         ← FastAPI app
    auth_setup.py   ← one-time Google OAuth2 setup script
    requirements.txt
    data/
      feedback.csv  ← drop exported CSV here (gitignored)
  frontend/
    src/
      App.tsx
      types.ts
      components/
        Leaderboard.tsx
        StatsBar.tsx
  start.sh          ← starts both backend and frontend
  .gitignore
```

### Security notes

- `backend/credentials.json` and `backend/token.json` are gitignored — never commit them
- `backend/data/feedback.csv` is gitignored — contains voter emails (PII)
- The Apps Script deployment returns only aggregated data — no emails are ever exposed
