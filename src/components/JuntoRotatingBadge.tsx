"use client";

type Props = {
  size?: number;
  duration?: number;
};

export default function JuntoRotatingBadge({ size = 200, duration = 18 }: Props) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size } as React.CSSProperties}
      aria-label="Junto rotating logo"
      role="img"
    >
      {/* Goo filter - subtle merge only at intersections, crisp edges */}
      <svg width={0} height={0} aria-hidden className="absolute">
        <defs>
          <filter
            id="junto-goo-badge"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.15" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" result="crispGoo" />
          </filter>
        </defs>
      </svg>

      {/* Outer ring - polar.sh style: textPath on circle + linear infinite */}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ animation: `junto-spin ${duration}s linear infinite` } as React.CSSProperties}
        aria-hidden
      >
        <defs>
          <path
            id="junto-badge-circle"
            d="M 100,100 m -75,0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
          />
        </defs>
        <circle cx="100" cy="100" r="75" fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} className="text-foreground" />
        <text
          fill="currentColor"
          className="text-foreground/60"
          style={{
            fontSize: "13.5px",
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <textPath href="#junto-badge-circle" startOffset="0%" textLength="471" lengthAdjust="spacing">
            JUNTO • JUNTO • JUNTO • JUNTO • JUNTO • JUNTO • JUNTO • JUNTO •
          </textPath>
        </text>
      </svg>

      {/* Center — crisp rings with fluid wobble + subtle goo behind (no grey halo) */}
      <div
        className="relative z-10 grid place-items-center rounded-full bg-card"
        style={{ width: size * 0.42, height: size * 0.42, border: "1px solid var(--border)" }}
      >
        {/* soft goo layer behind — slightly thicker, filtered, multiply blends without grey border */}
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ filter: "url(#junto-goo-badge)", mixBlendMode: "multiply" as const }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="64%" style={{ overflow: "visible" }} fill="none">
            <g fill="none" stroke="currentColor" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "-12deg", animationDelay: "0s" } as React.CSSProperties} />
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "14deg", animationDelay: "0.3s" } as React.CSSProperties} />
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "42deg", animationDelay: "0.6s" } as React.CSSProperties} />
            </g>
          </svg>
        </div>
        {/* crisp rings on top — stay in focus */}
        <div className="relative z-10 grid place-items-center" style={{ width: "64%", height: "64%" }}>
          <svg viewBox="0 0 24 24" width="100%" fill="none">
            <g fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" className="text-foreground">
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "-12deg", animationDelay: "0s" } as React.CSSProperties} />
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "14deg", animationDelay: "0.3s" } as React.CSSProperties} />
              <ellipse className="junto-goo-ellipse" cx={12} cy={12} rx={8.9} ry={10.6} style={{ ["--r" as string]: "42deg", animationDelay: "0.6s" } as React.CSSProperties} />
            </g>
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes junto-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .junto-goo-ellipse {
          transform-origin: 12px 12px;
          animation: junto-gooWobble 3.8s cubic-bezier(0.445,0.05,0.55,0.95) infinite;
        }
        @keyframes junto-gooWobble {
          0%,100% { transform: rotate(var(--r)) scaleX(1) scaleY(1); }
          33% { transform: rotate(var(--r)) scaleX(1.10) scaleY(0.92); }
          66% { transform: rotate(var(--r)) scaleX(0.92) scaleY(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg[style*="junto-spin"], .junto-goo-ellipse { animation: none !important; }
        }
        /* pause outer + inner on hover of the badge */
        div[role="img"]:hover svg[style*="junto-spin"] { animation-play-state: paused !important; }
        div[role="img"]:hover .junto-goo-ellipse { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
