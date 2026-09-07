"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1020",
          color: "#eef2ff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Headcount hit a snag</h1>
          <p style={{ color: "#b8c5e6", margin: "0 0 20px" }}>
            Reload to try again.{error.digest ? ` Ref ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#3d7cff",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
