import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM || "Junto <onboarding@resend.dev>";

type Send = { to: string; subject: string; html: string; replyTo?: string };

async function send({ to, subject, html, replyTo }: Send) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to, subject });
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
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

/**
 * Receipt for a self-reported payment.
 *
 * Junto never sees the money, so this isn't proof of anything — it's a record
 * of what the payer said they sent, and, more importantly, who to contact if
 * the event changes or is called off.
 */
export async function sendContributionReceipt(opts: {
  to: string;
  contributorName: string;
  eventName: string;
  amount: string;
  recipientName: string;
  methodLabel: string;
  shareUrl: string;
  organizerEmail: string;
}) {
  const html = frame(
    `You reported sending ${opts.amount}`,
    `
    <p>Hi ${opts.contributorName}, thanks — we've noted that you sent
    <strong>${opts.amount}</strong> to ${opts.recipientName} via
    ${opts.methodLabel} for <strong>${opts.eventName}</strong>.</p>
    <p>${opts.recipientName} will confirm it once it lands.</p>
    <p><a href="${opts.shareUrl}">View the event</a></p>
    <p style="margin-top:24px;color:#7a7a85;font-size:14px">Junto doesn't
    process payments — the money went directly to ${opts.recipientName}, so
    this is a record rather than a receipt. Questions, or the event changes?
    Contact the organizer at
    <a href="mailto:${opts.organizerEmail}">${opts.organizerEmail}</a>.</p>
    `,
  );
  await send({
    to: opts.to,
    subject: `You sent ${opts.amount} for ${opts.eventName}`,
    html,
    replyTo: opts.organizerEmail || undefined,
  });
}

export type CancelRecipient = {
  email: string;
  name: string;
  /** Sent money — needs the refund paragraph and a louder contact route. */
  contributed: boolean;
};

/**
 * Tells everyone attached to an event that it's been called off.
 *
 * Batched: Resend accepts up to 100 messages per call and each call counts as
 * one request against the rate limit, so a typical event is a single request.
 *
 * Returns real counts rather than swallowing failures — for an event with
 * money in play the organizer needs to know if someone wasn't reached so they
 * can follow up by hand.
 */
export async function sendEventCancelled(opts: {
  recipients: CancelRecipient[];
  eventName: string;
  reason: string | null;
  organizerEmail: string;
  shareUrl: string;
}): Promise<{ sent: number; failed: number }> {
  const { recipients } = opts;
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — cancellation notices not sent", {
      count: recipients.length,
    });
    return { sent: 0, failed: recipients.length };
  }

  const reasonBlock = opts.reason
    ? `<p style="background:#f6f6f8;border-radius:12px;padding:16px;margin:16px 0">${opts.reason}</p>`
    : "";

  const messages = recipients.map((r) => {
    const moneyBlock = r.contributed
      ? `<p style="margin-top:16px"><strong>You reported sending money for this event.</strong>
         Junto doesn't process payments, so there's nothing for us to refund — the
         money went directly to the organizer. Reply to this email to ask them
         about it.</p>`
      : "";

    return {
      from: FROM,
      to: r.email,
      replyTo: opts.organizerEmail || undefined,
      subject: `Cancelled: ${opts.eventName}`,
      html: frame(
        `${opts.eventName} has been cancelled`,
        `<p>Hi ${r.name}, the organizer has called this event off.</p>
         ${reasonBlock}
         ${moneyBlock}
         <p style="margin-top:16px"><a href="${opts.shareUrl}">View the event page</a></p>`,
      ),
    };
  });

  let sent = 0;
  let failed = 0;

  // 100 per batch is Resend's cap.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const { error } = await resend.batch.send(chunk);
      if (error) {
        console.error("[email] cancellation batch failed", error);
        failed += chunk.length;
      } else {
        sent += chunk.length;
      }
    } catch (e) {
      console.error("[email] cancellation batch threw", e);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}
