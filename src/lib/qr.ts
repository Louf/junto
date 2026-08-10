import QRCode from "qrcode";

/**
 * Renders a QR as an inline SVG string, generated on the server so the qrcode
 * library never ships to the browser.
 *
 * Used for the desktop payment handoff: Venmo dropped web payments in 2018 and
 * Cash App is app-first, so a laptop can't complete these payments. Scanning
 * moves the payer to the device that can.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#0000" },
  });
}
