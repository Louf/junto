import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/events";
import { formatEventDate } from "@/lib/dates";

export const alt = "Junto event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Ring positions for a 120px canvas: radius 44, dot 22. */
const DOTS = [
  { left: 49, top: 5 },
  { left: 87, top: 27 },
  { left: 87, top: 71 },
  { left: 49, top: 93 },
  { left: 11, top: 71 },
  { left: 11, top: 27 },
];

/**
 * Link preview for a shared event.
 *
 * Junto's whole pitch is "share one link", so the unfurl in a group chat is
 * the first thing most people ever see of an event. It shows what's actually
 * useful when deciding whether to tap: what, when, and how much is left.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);

  const name = ev?.name ?? "Junto";
  const cancelled = Boolean(ev?.cancelled_at);
  const when = ev ? formatEventDate(ev.event_at, ev.event_tz, "preview") : "";

  const capacity = ev?.jobs.reduce((n, j) => n + j.capacity, 0) ?? 0;
  const filled = ev?.jobs.reduce((n, j) => n + j.signups.length, 0) ?? 0;
  const remaining = Math.max(0, capacity - filled);

  const people = ev?.sheet_rows.length ?? 0;
  const pitchedIn = ev?.sheet_rows.filter((r) => r.ticks.length > 0).length ?? 0;

  const status = cancelled
    ? "Cancelled"
    : ev?.kind === "sheet"
      ? people === 0
        ? ""
        : `${pitchedIn} of ${people} have said how they’ll help`
      : capacity === 0
        ? ""
        : remaining === 0
          ? "Every slot filled"
          : `${remaining} of ${capacity} slots still open`;

  // The bar tracks slots filled, or for a sheet, people who've ticked something.
  const [done, total] =
    ev?.kind === "sheet" ? [pitchedIn, people] : [filled, capacity];
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f7f8",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", position: "relative", width: 120, height: 120 }}>
            {DOTS.map((d, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: d.left,
                  top: d.top,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: i === 0 ? "#1d9e75" : "#bcbcc4",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#0a0a0b" }}>
            Junto
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {cancelled && (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: 4,
                color: "#c0392b",
                marginBottom: 16,
              }}
            >
              CANCELLED
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#0a0a0b",
            }}
          >
            {name.length > 60 ? `${name.slice(0, 57)}…` : name}
          </div>
          {when && (
            <div style={{ display: "flex", fontSize: 34, color: "#6b6b73", marginTop: 20 }}>
              {when}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {total > 0 && !cancelled && (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 14,
                borderRadius: 7,
                background: "#e4e4e7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: `${pct}%`,
                  height: 14,
                  borderRadius: 7,
                  background: "#1d9e75",
                }}
              />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 30, color: "#3d3d42" }}>{status}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#8a8a91" }}>
              Sign up. Show up.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
