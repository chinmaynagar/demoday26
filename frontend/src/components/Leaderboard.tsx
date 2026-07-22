import { LeaderboardEntry } from "../types";

interface Props {
  entries: LeaderboardEntry[];
}

const MEDAL: Record<number, { emoji: string; color: string; glow: string }> = {
  1: { emoji: "🥇", color: "#f5c842", glow: "rgba(245,200,66,0.18)" },
  2: { emoji: "🥈", color: "#b0bec5", glow: "rgba(176,190,197,0.14)" },
  3: { emoji: "🥉", color: "#cd7f32", glow: "rgba(205,127,50,0.14)" },
};

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#1f2d45",
          borderRadius: 99,
          overflow: "hidden",
          minWidth: 60,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 99,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          fontWeight: 700,
          fontSize: 15,
          color,
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function floorBadge(demoId: string): { label: string; color: string; bg: string; border: string } | null {
  const n = parseInt(demoId, 10);
  if (isNaN(n)) return null;
  if (n >= 1 && n <= 30)  return { label: "3rd Floor", color: "#67e8f9", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.35)"  };
  if (n >= 31 && n <= 60) return { label: "7th Floor", color: "#86efac", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)"  };
  if (n >= 61 && n <= 100) return { label: "8th Floor", color: "#fda4af", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.35)"  };
  return null;
}

function AspectTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "rgba(99,102,241,0.15)",
        color: "#a5b4fc",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 99,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDAL[rank];
  if (medal) {
    return (
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: medal.glow,
          border: `2px solid ${medal.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {medal.emoji}
      </div>
    );
  }
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#1a2235",
        border: "2px solid #1f2d45",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 700,
        color: "#8b9ab5",
        flexShrink: 0,
      }}
    >
      #{rank}
    </div>
  );
}

export default function Leaderboard({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#8b9ab5",
          fontSize: 16,
        }}
      >
        No feedback data yet. Upload a CSV to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map((entry) => {
        const medal = MEDAL[entry.rank];
        return (
          <div
            key={entry.demo_id}
            style={{
              background: medal ? `linear-gradient(135deg, #111827, #1a2235)` : "#111827",
              border: `1px solid ${medal ? medal.color + "40" : "#1f2d45"}`,
              borderRadius: 16,
              padding: "18px 24px",
              display: "grid",
              gridTemplateColumns: "44px 1fr",
              gap: "0 20px",
              alignItems: "center",
              boxShadow: medal ? `0 0 20px ${medal.glow}` : "none",
              transition: "transform 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.transform = "translateY(0)")
            }
          >
            {/* Rank badge */}
            <RankBadge rank={entry.rank} />

            {/* Middle: demo id, score bar, aspects */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#f0f4ff" }}>
                  Demo #{entry.demo_id}
                </span>
                {(() => {
                  const floor = floorBadge(entry.demo_id);
                  return floor ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: floor.color,
                        background: floor.bg,
                        border: `1px solid ${floor.border}`,
                        borderRadius: 99,
                        padding: "2px 8px",
                        letterSpacing: 0.3,
                      }}
                    >
                      📍 {floor.label}
                    </span>
                  ) : null;
                })()}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8b9ab5",
                    background: "#1a2235",
                    border: "1px solid #1f2d45",
                    borderRadius: 99,
                    padding: "2px 8px",
                    letterSpacing: 0.3,
                  }}
                >
                  {entry.unique_feedbacks} visit{entry.unique_feedbacks !== 1 ? "s" : ""}
                </span>
              </div>
              <ScoreBar score={entry.avg_score} />
              {entry.top_aspects.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {entry.top_aspects.map((a) => (
                    <AspectTag key={a} label={a} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
