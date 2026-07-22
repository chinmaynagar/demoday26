import { useCallback, useEffect, useRef, useState } from "react";
import Leaderboard from "./components/Leaderboard";
import StatsBar from "./components/StatsBar";
import { LeaderboardResponse, StatsResponse, SyncStatus } from "./types";

const REFRESH_INTERVAL_MS = 30_000;

type FetchState = "idle" | "loading" | "error";

function SyncIndicator({ sync }: { sync: SyncStatus | null }) {
  if (!sync) return null;

  const ok = sync.last_sync_ok;
  const dot = ok ? "#22c55e" : "#f59e0b";
  const label = ok ? "Synced" : "Sync pending";
  const nextIn = sync.next_sync_in_seconds != null
    ? `Next pull in ${sync.next_sync_in_seconds}s`
    : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "#1a2235",
        border: "1px solid #1f2d45",
        borderRadius: 10,
        padding: "7px 14px",
        fontSize: 12,
        color: "#8b9ab5",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dot,
          boxShadow: `0 0 6px ${dot}`,
          flexShrink: 0,
        }}
      />
      <span style={{ color: ok ? "#86efac" : "#fde68a", fontWeight: 600 }}>{label}</span>
      {nextIn && <span style={{ color: "#8b9ab5" }}>· {nextIn}</span>}
      {sync.last_error && (
        <span style={{ color: "#fca5a5" }} title={sync.last_error}>⚠</span>
      )}
    </div>
  );
}

type FetchAllResult = {
  lb: LeaderboardResponse;
  st: StatsResponse;
  sync: SyncStatus;
};

export default function App() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const [isPulsing, setIsPulsing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (): Promise<FetchAllResult | null> => {
    setFetchState("loading");
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 800);

    try {
      const [lbRes, stRes, syncRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/stats"),
        fetch("/api/sync-status"),
      ]);
      if (!lbRes.ok || !stRes.ok) throw new Error("Fetch failed");
      const [lb, st, syncData] = await Promise.all([
        lbRes.json(),
        stRes.json(),
        syncRes.ok ? syncRes.json() : Promise.resolve(null),
      ]);
      setLeaderboard(lb);
      setStats(st);
      setSync(syncData);
      setFetchState("idle");
      setCountdown(REFRESH_INTERVAL_MS / 1000);
      return { lb, st, sync: syncData };
    } catch {
      setFetchState("error");
      setCountdown(REFRESH_INTERVAL_MS / 1000);
      return null;
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setTimeout(() => {
      fetchData().then(scheduleNext);
    }, REFRESH_INTERVAL_MS);

    let secs = REFRESH_INTERVAL_MS / 1000;
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0 && countdownRef.current) clearInterval(countdownRef.current);
    }, 1000);
  }, [fetchData]);

  useEffect(() => {
    fetchData().then(scheduleNext);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData, scheduleNext]);

  const handleManualRefresh = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    fetchData().then(scheduleNext);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1525 100%)",
        padding: "0 0 60px",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(90deg, #111827, #1a1f35)",
          borderBottom: "1px solid #1f2d45",
          padding: "24px 32px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                background: "linear-gradient(90deg, #818cf8, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.5px",
              }}
            >
              🏆 Demo Day Leaderboard
            </h1>
            <p style={{ fontSize: 13, color: "#8b9ab5", marginTop: 4 }}>
              Top 10 projects by average score &nbsp;·&nbsp; Live rankings
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <SyncIndicator sync={sync} />
            <button
              onClick={handleManualRefresh}
              title="Refresh leaderboard now"
              style={{
                background: isPulsing ? "#4f46e5" : "#1a2235",
                border: "1px solid #1f2d45",
                borderRadius: 10,
                padding: "8px 14px",
                color: "#8b9ab5",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "background 0.3s",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-block", animation: isPulsing ? "spin 0.8s linear" : "none" }}>🔄</span>
              {fetchState === "loading" ? "Refreshing…" : `Refresh in ${countdown}s`}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 900, margin: "32px auto", padding: "0 24px" }}>
        {fetchState === "error" && (
          <div
            style={{
              background: "#1f0a0a",
              border: "1px solid #7f1d1d",
              borderRadius: 12,
              padding: "14px 20px",
              color: "#fca5a5",
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            ⚠️ Could not reach the backend. Make sure the FastAPI server is running on port 8000.
          </div>
        )}

        {stats && (
          <div style={{ marginBottom: 28 }}>
            <StatsBar
              totalSubmissions={stats.total_submissions}
              uniqueProjects={stats.total_unique_projects}
              uniqueVoters={stats.total_unique_voters}
              lastUpdated={stats.last_updated}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#8b9ab5", letterSpacing: 1, textTransform: "uppercase" }}>
            Top 10 Projects
          </h2>
          {leaderboard && (
            <span style={{ fontSize: 12, color: "#8b9ab5" }}>
              {leaderboard.total_entries} deduplicated votes · {leaderboard.leaderboard.length} shown
            </span>
          )}
        </div>

        {leaderboard ? (
          <Leaderboard entries={leaderboard.leaderboard} />
        ) : fetchState === "loading" ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8b9ab5" }}>Loading…</div>
        ) : null}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
