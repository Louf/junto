import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM || "Junto <onboarding@resend.dev>";

type Send = { to: string; subject: string; html: string };

async function send({ to, subject, html }: Send) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to, subject });
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) console.error("[email] send failed", error);
}

function frame(title: string, body: string) {
  return `<!doctype html>
  <html><body style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;background:#f6f6f8;padding:32px;color:#111">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,.04)">
      <div style="font-weight:700;font-size:14px;letter-spacing:.04em;color:#7a7a85;text-transform:uppercase">Junto</div>
      <h1 style="margin:8px 0 16px;font-size:22px;line-height:1.25">${title}</h1>
      ${body}
    </div>
  </body></html>`;
}

export async function sendCreatorWelcome(opts: {
  to: string;
  eventName: string;
  shareUrl: string;
  manageUrl: string;
}) {
  const html = frame(
    `Your event "${opts.eventName}" is live`,
    `
    <p>Share this link so people can claim slots:</p>
    <p><a href="${opts.shareUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 16px;border-radius:12px;text-decoration:none">${opts.shareUrl}</a></p>
    <p style="margin-top:24px">Keep this link safe — it's how you'll edit the event later:</p>
    <p><a href="${opts.manageUrl}">${opts.manageUrl}</a></p>
    `,
  );
  await send({ to: opts.to, subject: `Your Junto event is live`, html });
}

export async function sendSignupConfirmation(opts: {
  to: string;
  participantName: string;
  eventName: string;
  jobTitle: string;
  shareUrl: string;
  cancelUrl: string;
}) {
  const html = frame(
    `You're signed up for ${opts.eventName}`,
    `
    <p>Hi ${opts.participantName}, you've claimed a slot for <strong>${opts.jobTitle}</strong>.</p>
    <p><a href="${opts.shareUrl}">View the event</a></p>
    <p style="margin-top:24px;color:#7a7a85;font-size:14px">Need to release your slot? <a href="${opts.cancelUrl}">Cancel here</a>.</p>
    `,
  );
  await send({
    to: opts.to,
    subject: `You're signed up for ${opts.eventName}`,
    html,
  });
}
