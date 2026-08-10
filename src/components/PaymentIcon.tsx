import type { PaymentMethod } from "@/lib/payments";
import {
  PAYMENT_ICON_PATHS,
  PAYMENT_ICON_VIEWBOX,
} from "@/components/paymentIconPaths";

/** Generic wallet, used when a brand path isn't available. */
const FALLBACK_PATH =
  "M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1.5H5.5A2.5 2.5 0 0 1 3 6v10.5A2.5 2.5 0 0 0 5.5 19H19a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5";

type Props = {
  method: PaymentMethod;
  /** Pixel size. Keep small — this is a scanning aid, not the label. */
  size?: number;
  className?: string;
};

/**
 * Monochrome payment method glyph. Inherits color from its parent so it never
 * fights the palette, and is always decorative — every use sits next to a
 * visible text label, so nothing depends on recognising the mark.
 */
export function PaymentIcon({ method, size = 16, className }: Props) {
  const brandPath = PAYMENT_ICON_PATHS[method];
  const isBrand = Boolean(brandPath);

  return (
    <svg
      viewBox={PAYMENT_ICON_VIEWBOX}
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: "block", flex: "none" }}
      {...(isBrand
        ? { fill: "currentColor" }
        : {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.6,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
          })}
    >
      <path d={brandPath ?? FALLBACK_PATH} />
    </svg>
  );
}

export default PaymentIcon;
