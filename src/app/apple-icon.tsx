import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ring positions for a 180px canvas: radius 52, dot 30. */
const DOTS = [
  { left: 75, top: 23 },
  { left: 120, top: 49 },
  { left: 120, top: 101 },
  { left: 75, top: 127 },
  { left: 30, top: 101 },
  { left: 30, top: 49 },
];

/**
 * Apple touch icon, drawn rather than shipped as a binary so it stays in step
 * with JuntoMark. iOS ignores transparency and applies its own rounding, so
 * this fills the canvas with the brand color.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1d9e75",
        }}
      >
        {DOTS.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.left,
              top: d.top,
              width: 30,
              height: 30,
              borderRadius: 15,
              background: "#ffffff",
              opacity: i === 0 ? 1 : 0.55,
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
