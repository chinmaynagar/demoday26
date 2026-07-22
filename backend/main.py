import re
import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Demo Day Leaderboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
CSV_PATH = DATA_DIR / "feedback.csv"

# ── Data source selector ─────────────────────────────────────────────────────
# "local_csv"     — read from backend/data/feedback.csv  (default)
# "google_sheets" — pull from Google Sheets via OAuth2 every N seconds
DATA_SOURCE: str = os.environ.get("DATA_SOURCE", "local_csv")

# ── Google Sheets config (only used when DATA_SOURCE=google_sheets) ──────────
SPREADSHEET_ID: str        = os.environ.get("SPREADSHEET_ID", "")
SHEET_NAME: str            = os.environ.get("SHEET_NAME", "")
SYNC_INTERVAL_SECONDS: int = int(os.environ.get("SYNC_INTERVAL_SECONDS", "300"))

CREDS_FILE = Path(__file__).parent / "credentials.json"
TOKEN_FILE  = Path(__file__).parent / "token.json"

# ── Column name aliases (matches Google Form / Sheets export headers) ────────
COL_TIMESTAMP = "Timestamp"
COL_EMAIL     = "Email Address"
COL_DEMO_ID   = "Which Demo ID are you providing feedback for?"
COL_RATING    = "Overall Rating (1 = Poor, 10 = Excellent)"
COL_ASPECTS   = "What aspects of the project were the strongest?"

# ── In-memory sync state ─────────────────────────────────────────────────────
_sync_state: dict = {
    "last_synced_at": None,
    "last_sync_ok":   False,
    "last_error":     None,
}


# ════════════════════════════════════════════════════════════════════════════
#  MODE 1 — useLocalData
#  Reads feedback.csv from backend/data/. Drop a fresh CSV export there and
#  the next leaderboard refresh will pick it up automatically.
# ════════════════════════════════════════════════════════════════════════════

def useLocalData() -> pd.DataFrame:
    if not CSV_PATH.exists():
        log.warning("feedback.csv not found at %s", CSV_PATH)
        return pd.DataFrame()
    return pd.read_csv(CSV_PATH, dtype=str)


# ════════════════════════════════════════════════════════════════════════════
#  MODE 2 — useGoogleData
#  Uses OAuth2 (your Nutanix Google account) via token.json.
#  Run  python3 backend/auth_setup.py  once to generate token.json.
#
#  Required env vars:
#    SPREADSHEET_ID  — ID from the sheet URL:
#                      docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
#    SHEET_NAME      — worksheet tab name (default: first sheet)
#    SYNC_INTERVAL_SECONDS — poll interval in seconds (default: 300)
#
#  The scheduler calls pull_from_google_sheets() on startup and every N secs.
#  It writes the result to feedback.csv so the last good fetch is always cached.
# ════════════════════════════════════════════════════════════════════════════

def useGoogleData() -> pd.DataFrame:
    """Fetch sheet rows via OAuth2 token and return as a DataFrame."""
    try:
        import gspread
    except ImportError as exc:
        raise RuntimeError(
            "gspread not installed. Run: pip install gspread google-auth-oauthlib"
        ) from exc

    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"token.json not found at {TOKEN_FILE}. "
            "Run  python3 backend/auth_setup.py  to authenticate."
        )
    if not SPREADSHEET_ID:
        raise ValueError(
            "SPREADSHEET_ID env var is not set. "
            "Find it in your sheet URL: docs.google.com/spreadsheets/d/<ID>/edit"
        )

    gc = gspread.oauth(
        credentials_filename=str(CREDS_FILE) if CREDS_FILE.exists() else None,
        authorized_user_filename=str(TOKEN_FILE),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    sh = gc.open_by_key(SPREADSHEET_ID)
    ws = sh.worksheet(SHEET_NAME) if SHEET_NAME else sh.get_worksheet(0)
    records = ws.get_all_records(head=1)
    return pd.DataFrame(records).astype(str)


def pull_from_google_sheets() -> None:
    """Scheduler job: fetch from Google Sheets → overwrite feedback.csv cache."""
    log.info("Pulling from Google Sheets (id=%s)", SPREADSHEET_ID)
    try:
        df = useGoogleData()
        CSV_PATH.write_text(df.to_csv(index=False), encoding="utf-8")
        _sync_state["last_synced_at"] = datetime.now(timezone.utc).isoformat()
        _sync_state["last_sync_ok"]   = True
        _sync_state["last_error"]     = None
        log.info("Sync OK — %d rows cached to feedback.csv", len(df))
    except Exception as exc:
        _sync_state["last_sync_ok"] = False
        _sync_state["last_error"]   = str(exc)
        log.error("Sync failed: %s", exc)


# ── Active data loader ───────────────────────────────────────────────────────
# Both modes ultimately read from feedback.csv.
# In google_sheets mode the scheduler keeps that file fresh.

def load_raw() -> pd.DataFrame:
    return useLocalData()   # always read the local cache


# ── Shared processing pipeline ───────────────────────────────────────────────

def load_and_process() -> pd.DataFrame:
    df = load_raw()
    if df.empty:
        return df

    required = [COL_EMAIL, COL_DEMO_ID, COL_RATING]
    df = df.dropna(subset=required)
    df = df[df[COL_DEMO_ID].str.strip() != ""]
    df = df[df[COL_RATING].str.strip() != ""]

    df["demo_id"] = df[COL_DEMO_ID].apply(
        lambda v: re.sub(r"^Option\s+", "", str(v).strip()) if not pd.isna(v) else ""
    )
    df = df[df["demo_id"] != ""]

    df["rating"] = pd.to_numeric(df[COL_RATING], errors="coerce")
    df = df.dropna(subset=["rating"])
    df["rating"] = df["rating"].clip(1, 10)

    df["email"] = df[COL_EMAIL].str.strip().str.lower()

    df["ts"] = pd.to_datetime(df[COL_TIMESTAMP], errors="coerce")
    df = df.sort_values("ts", ascending=True)
    df = df.drop_duplicates(subset=["email", "demo_id"], keep="last")

    return df


def compute_leaderboard(df: pd.DataFrame, top_n: int = 10) -> list[dict]:
    if df.empty:
        return []

    global_mean = float(df["rating"].mean())
    C = float(df.groupby("demo_id")["rating"].count().mean())

    rows = []
    for demo_id, group in df.groupby("demo_id"):
        ratings          = group["rating"].tolist()
        unique_feedbacks = len(ratings)
        total_score      = sum(ratings)
        avg_score        = round(total_score / unique_feedbacks, 1)
        bayesian_score   = (C * global_mean + total_score) / (C + unique_feedbacks)

        aspect_counts: dict[str, int] = {}
        for cell in (group[COL_ASPECTS].dropna() if COL_ASPECTS in group.columns else []):
            for aspect in str(cell).split(","):
                aspect = aspect.strip()
                if aspect:
                    aspect_counts[aspect] = aspect_counts.get(aspect, 0) + 1
        top_aspects = [a for a, _ in sorted(aspect_counts.items(), key=lambda x: -x[1])[:3]]

        rows.append({
            "demo_id":          demo_id,
            "avg_score":        avg_score,
            "total_score":      int(total_score),
            "unique_feedbacks": unique_feedbacks,
            "top_aspects":      top_aspects,
            "bayesian_score":   round(bayesian_score, 4),
        })

    rows.sort(key=lambda r: (-r["bayesian_score"], -r["avg_score"]))
    for i, row in enumerate(rows[:top_n], start=1):
        row["rank"] = i

    return rows[:top_n]


# ── Startup / shutdown ───────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    log.info("Data source: %s", DATA_SOURCE)
    if DATA_SOURCE == "google_sheets":
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            pull_from_google_sheets,
            trigger="interval",
            seconds=SYNC_INTERVAL_SECONDS,
            id="sheet_sync",
            next_run_time=datetime.now(),
        )
        scheduler.start()
        app.state.scheduler = scheduler
        log.info(
            "Google Sheets scheduler started — polling every %ds (SPREADSHEET_ID=%s)",
            SYNC_INTERVAL_SECONDS, SPREADSHEET_ID or "(not set)",
        )
    else:
        app.state.scheduler = None
        log.info("Serving static feedback.csv from %s", CSV_PATH)


@app.on_event("shutdown")
def on_shutdown():
    if getattr(app.state, "scheduler", None):
        app.state.scheduler.shutdown(wait=False)


# ── Response models ──────────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank:             int
    demo_id:          str
    avg_score:        float
    total_score:      int
    unique_feedbacks: int
    top_aspects:      list[str]
    bayesian_score:   float


class LeaderboardResponse(BaseModel):
    leaderboard:           list[LeaderboardEntry]
    last_updated:          Optional[str]
    total_submissions_raw: int
    total_entries:         int
    data_source:           str


class StatsResponse(BaseModel):
    total_submissions:     int
    total_unique_projects: int
    total_unique_voters:   int
    last_updated:          Optional[str]
    data_source:           str


class SyncStatusResponse(BaseModel):
    data_source:           str
    google_sheets_enabled: bool
    last_synced_at:        Optional[str]
    last_sync_ok:          bool
    last_error:            Optional[str]
    next_sync_in_seconds:  Optional[int]
    interval_seconds:      int


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard():
    df = load_and_process()

    last_updated = None
    total_raw    = 0
    if CSV_PATH.exists():
        mtime = os.path.getmtime(CSV_PATH)
        last_updated = datetime.utcfromtimestamp(mtime).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            raw = pd.read_csv(CSV_PATH, dtype=str)
            total_raw = int(raw[raw[COL_EMAIL].notna() & raw[COL_RATING].notna()].shape[0])
        except Exception:
            pass

    return LeaderboardResponse(
        leaderboard=compute_leaderboard(df),
        last_updated=last_updated,
        total_submissions_raw=total_raw,
        total_entries=len(df),
        data_source=DATA_SOURCE,
    )


@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    df = load_and_process()

    last_updated = None
    if CSV_PATH.exists():
        mtime = os.path.getmtime(CSV_PATH)
        last_updated = datetime.utcfromtimestamp(mtime).strftime("%Y-%m-%dT%H:%M:%SZ")

    if df.empty:
        return StatsResponse(
            total_submissions=0,
            total_unique_projects=0,
            total_unique_voters=0,
            last_updated=last_updated,
            data_source=DATA_SOURCE,
        )

    return StatsResponse(
        total_submissions=len(df),
        total_unique_projects=int(df["demo_id"].nunique()),
        total_unique_voters=int(df["email"].nunique()),
        last_updated=last_updated,
        data_source=DATA_SOURCE,
    )


@app.get("/api/sync-status", response_model=SyncStatusResponse)
def get_sync_status():
    next_in: Optional[int] = None
    scheduler = getattr(app.state, "scheduler", None)
    if scheduler:
        job = scheduler.get_job("sheet_sync")
        if job and job.next_run_time:
            delta = (job.next_run_time.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds()
            next_in = max(0, int(delta))

    return SyncStatusResponse(
        data_source=DATA_SOURCE,
        google_sheets_enabled=(DATA_SOURCE == "google_sheets"),
        last_synced_at=_sync_state["last_synced_at"],
        last_sync_ok=_sync_state["last_sync_ok"] if DATA_SOURCE == "google_sheets" else True,
        last_error=_sync_state["last_error"],
        next_sync_in_seconds=next_in,
        interval_seconds=SYNC_INTERVAL_SECONDS,
    )


@app.get("/health")
def health():
    return {"status": "ok", "data_source": DATA_SOURCE}
