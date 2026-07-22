interface Props {
  totalSubmissions: number;
  uniqueProjects: number;
  uniqueVoters: number;
  lastUpdated: string | null;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2d45",
        borderRadius: 14,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flex: 1,
        minWidth: 160,
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f4ff" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#8b9ab5", fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export default function StatsBar({
  totalSubmissions,
  uniqueProjects,
  uniqueVoters,
  lastUpdated,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <StatCard icon="📝" label="Total Submissions" value={totalSubmissions} />
        <StatCard icon="🚀" label="Projects Ranked" value={uniqueProjects} />
        <StatCard icon="👥" label="Unique Voters" value={uniqueVoters} />
      </div>
      {lastUpdated && (
        <div style={{ textAlign: "right", fontSize: 12, color: "#8b9ab5" }}>
          Last updated: {formatTime(lastUpdated)}
        </div>
      )}
    </div>
  );
}
