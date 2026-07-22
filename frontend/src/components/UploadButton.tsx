import { useRef, useState } from "react";

interface Props {
  onUploadSuccess: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadButton({ onUploadSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setState("error");
      setMessage("Please select a .csv file");
      return;
    }

    setState("uploading");
    setMessage("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "Upload failed");
      }
      setState("success");
      setMessage(data.message);
      onUploadSuccess();
      setTimeout(() => setState("idle"), 4000);
    } catch (err: unknown) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setState("idle"), 5000);
    }
  };

  const bgColor =
    state === "success"
      ? "#15803d"
      : state === "error"
      ? "#991b1b"
      : state === "uploading"
      ? "#3730a3"
      : "#4f46e5";

  const label =
    state === "uploading"
      ? "Uploading…"
      : state === "success"
      ? "Uploaded!"
      : state === "error"
      ? "Error"
      : "Upload CSV";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        style={{
          background: bgColor,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "background 0.2s, opacity 0.2s",
          opacity: state === "uploading" ? 0.7 : 1,
        }}
      >
        <span style={{ fontSize: 16 }}>
          {state === "uploading" ? "⏳" : state === "success" ? "✅" : state === "error" ? "❌" : "📂"}
        </span>
        {label}
      </button>
      {message && (
        <span
          style={{
            fontSize: 12,
            color: state === "error" ? "#fca5a5" : "#86efac",
            maxWidth: 260,
            textAlign: "right",
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
