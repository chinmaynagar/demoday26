"""
One-time OAuth2 setup for Google Sheets access.

Run this once before switching to google_sheets data source:
    python3 auth_setup.py

What it does:
  1. Reads credentials.json (your OAuth2 client secret from GCP Console)
  2. Opens a browser — log in with your Nutanix Google account
  3. Saves token.json in this directory for the backend to reuse

Prerequisites — do these once in GCP Console (console.cloud.google.com):
  1. Create a project (any name, e.g. "demo-day-leaderboard")
  2. APIs & Services → Enable APIs → search "Google Sheets API" → Enable
  3. APIs & Services → Credentials → Create Credentials → OAuth client ID
       - Application type: Desktop app
       - Name: anything (e.g. "demo-day-leaderboard")
  4. Download JSON → rename to "credentials.json" → place in this folder (backend/)
  5. APIs & Services → OAuth consent screen → Add your Nutanix email under
     "Test users" (needed while the app is in Testing mode)

Then run:
    cd backend && python3 auth_setup.py
"""

from pathlib import Path
import sys

CREDS_FILE = Path(__file__).parent / "credentials.json"
TOKEN_FILE  = Path(__file__).parent / "token.json"

if not CREDS_FILE.exists():
    print(
        "\n❌  credentials.json not found.\n"
        "    Download it from GCP Console → APIs & Services → Credentials\n"
        "    and place it at:  backend/credentials.json\n"
        "\nSee the instructions at the top of this file for details."
    )
    sys.exit(1)

try:
    import gspread
except ImportError:
    print("Installing gspread + google-auth-oauthlib ...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "gspread", "google-auth-oauthlib", "-q"])
    import gspread

print("\nOpening browser for Google sign-in...")
print("Log in with your Nutanix Google account that has access to the sheet.\n")

gc = gspread.oauth(
    credentials_filename=str(CREDS_FILE),
    authorized_user_filename=str(TOKEN_FILE),
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
)

print(f"✅  Auth successful!  token.json saved to {TOKEN_FILE}")
print(f"    Logged in as: {gc.auth.token}\n")
print("Next steps:")
print("  1. Set your spreadsheet ID in the env var SPREADSHEET_ID")
print("  2. Optionally set SHEET_NAME (defaults to first sheet)")
print("  3. Start the server:  DATA_SOURCE=google_sheets ./start.sh")
