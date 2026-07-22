// ── Configuration ─────────────────────────────────────────────────────────────
// Change SHEET_NAME to match your form responses tab name exactly.
var SHEET_NAME = "TEST_DATA";
var TOP_N      = 10;

// These must match your Google Form column headers exactly.
var COL_TIMESTAMP = "Timestamp";
var COL_EMAIL     = "Email Address";
var COL_DEMO_ID   = "Which Demo ID are you providing feedback for?";
var COL_RATING    = "Overall Rating (1 = Poor, 10 = Excellent)";
var COL_ASPECTS   = "What aspects of the project were the strongest?";

// ── Entry point ───────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Demo Day Leaderboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Data functions (called from the frontend via google.script.run) ───────────

function getLeaderboardData() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { error: "Sheet '" + SHEET_NAME + "' not found. Check the SHEET_NAME variable in Code.gs." };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { leaderboard: [], stats: { total: 0, projects: 0, voters: 0 }, lastUpdated: new Date().toISOString() };
  }

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows    = data.slice(1);

  // Map column names → indices
  var idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var tsIdx      = idx[COL_TIMESTAMP];
  var emailIdx   = idx[COL_EMAIL];
  var demoIdx    = idx[COL_DEMO_ID];
  var ratingIdx  = idx[COL_RATING];
  var aspectsIdx = idx[COL_ASPECTS] !== undefined ? idx[COL_ASPECTS] : -1;

  // ── Parse rows ──────────────────────────────────────────────────────────────
  var parsed = [];
  rows.forEach(function(row) {
    var email  = String(row[emailIdx]  || "").trim().toLowerCase();
    var raw    = String(row[demoIdx]   || "").trim();
    var demoId = raw.replace(/^Option\s+/i, "");          // "Option 8" → "8"
    var rating = parseFloat(row[ratingIdx]);
    var ts     = new Date(row[tsIdx]);
    var aspects = aspectsIdx >= 0 ? String(row[aspectsIdx] || "") : "";

    if (!email || !demoId || isNaN(rating)) return;
    rating = Math.max(1, Math.min(10, rating));           // clamp 1–10

    parsed.push({ email: email, demoId: demoId, rating: rating, ts: ts, aspects: aspects });
  });

  // ── Deduplicate: per (email, demoId) keep latest timestamp ─────────────────
  var deduped = {};
  parsed.forEach(function(r) {
    var key = r.email + "|||" + r.demoId;
    if (!deduped[key] || r.ts > deduped[key].ts) {
      deduped[key] = r;
    }
  });
  var entries = Object.keys(deduped).map(function(k) { return deduped[k]; });

  // ── Aggregate per project ───────────────────────────────────────────────────
  var projects = {};
  entries.forEach(function(r) {
    if (!projects[r.demoId]) projects[r.demoId] = { ratings: [], aspectCells: [] };
    projects[r.demoId].ratings.push(r.rating);
    if (r.aspects) projects[r.demoId].aspectCells.push(r.aspects);
  });

  // ── Bayesian average parameters ─────────────────────────────────────────────
  var allRatings  = entries.map(function(r) { return r.rating; });
  var globalMean  = allRatings.reduce(function(a, b) { return a + b; }, 0) / allRatings.length;
  var demoIds     = Object.keys(projects);
  var C           = demoIds.reduce(function(sum, id) {
    return sum + projects[id].ratings.length;
  }, 0) / demoIds.length;   // mean votes per project = confidence weight

  // ── Build ranked rows ───────────────────────────────────────────────────────
  var ranked = demoIds.map(function(demoId) {
    var p   = projects[demoId];
    var n   = p.ratings.length;
    var sum = p.ratings.reduce(function(a, b) { return a + b; }, 0);
    var avg = Math.round((sum / n) * 10) / 10;
    var bayesian = (C * globalMean + sum) / (C + n);

    // Top 3 aspects by frequency
    var aspectCounts = {};
    p.aspectCells.forEach(function(cell) {
      cell.split(",").forEach(function(a) {
        a = a.trim();
        if (a) aspectCounts[a] = (aspectCounts[a] || 0) + 1;
      });
    });
    var topAspects = Object.keys(aspectCounts)
      .sort(function(a, b) { return aspectCounts[b] - aspectCounts[a]; })
      .slice(0, 3);

    return {
      demoId:          demoId,
      avgScore:        avg,
      uniqueFeedbacks: n,
      topAspects:      topAspects,
      bayesianScore:   Math.round(bayesian * 10000) / 10000
    };
  });

  ranked.sort(function(a, b) {
    return (b.bayesianScore - a.bayesianScore) || (b.avgScore - a.avgScore);
  });

  var leaderboard = ranked.slice(0, TOP_N).map(function(r, i) {
    r.rank = i + 1;
    return r;
  });

  // ── Stats ───────────────────────────────────────────────────────────────────
  var uniqueVoters = {};
  entries.forEach(function(r) { uniqueVoters[r.email] = true; });

  return {
    leaderboard: leaderboard,
    stats: {
      total:    entries.length,
      projects: demoIds.length,
      voters:   Object.keys(uniqueVoters).length
    },
    lastUpdated: new Date().toISOString()
  };
}
