type Props = {
  /** Rendered width/height in px. */
  size?: number;
  /** Highlight the leading dot in the brand color. */
  accent?: boolean;
  /** Stagger the dots in around the ring on mount. Ignored under prefers-reduced-motion. */
  animate?: boolean;
  /** Accessible label. Pass null to mark the SVG decorative. */
  label?: string | null;
  className?: string;
};

/** Six seats around a circle, one taken. */
const SEATS = [
  { cx: 50, cy: 20 },
  { cx: 75.98, cy: 35 },
  { cx: 75.98, cy: 65 },
  { cx: 50, cy: 80 },
  { cx: 24.02, cy: 65 },
  { cx: 24.02, cy: 35 },
] as const;

export function JuntoMark({
  size = 320,
  accent = true,
  animate = false,
  label = "Junto",
  className,
}: Props) {
  const decorative = label === null;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      style={{ display: "block", overflow: "visible" }}
    >
      {!decorative && <title>{label}</title>}
      <g>
        {SEATS.map((seat, i) => (
          <circle
            key={i}
            cx={seat.cx}
            cy={seat.cy}
            r={8}
            fill={
              accent && i === 0 ? "var(--logo-accent)" : "var(--logo-dot)"
            }
            className={animate ? "junto-mark-dot" : undefined}
            style={
              animate
                ? ({ animationDelay: `${i * 90}ms` } as React.CSSProperties)
                : undefined
            }
          />
        ))}
      </g>

      {animate && (
        <style>{`
          .junto-mark-dot {
            transform-box: fill-box;
            transform-origin: center;
            animation: junto-mark-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes junto-mark-in {
            from { opacity: 0; transform: scale(0.4); }
            to   { opacity: 1; transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .junto-mark-dot { animation: none; }
          }
        `}</style>
      )}
    </svg>
  );
}

export default JuntoMark;
