export type EventRow = {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  event_at: string;
  /** IANA zone the event happens in. Null on pre-existing rows. */
  event_tz: string | null;
  banner_path: string | null;
  creator_email: string;
  creator_user_id: string | null;
  edit_token: string;
  slug: string;
  /** Set when the organizer calls the event off. The page stays reachable. */
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type JobRow = {
  id: string;
  created_at: string;
  event_id: string;
  title: string;
  description: string | null;
  capacity: number;
  sort_order: number;
};

export type SignupRow = {
  id: string;
  created_at: string;
  job_id: string;
  name: string;
  email: string;
  note: string | null;
  cancel_token: string;
};

export type FundRow = {
  id: string;
  created_at: string;
  event_id: string;
  mode: "reimburse" | "goal" | "split";
  /** Whoever receives the money — the person who fronted it, or the organizer. */
  recipient_name: string;
  /** Null until the organizer knows what was actually spent. */
  total_cents: number | null;
  /** Fixed per-person amount. Null in goal mode, where payers choose. */
  share_cents: number | null;
  /** Split mode only: how many people are dividing the cost. */
  headcount: number | null;
  method: "venmo" | "cashapp" | "paypal" | "zelle";
  handle: string;
  note: string | null;
};

export type ContributionRow = {
  id: string;
  created_at: string;
  fund_id: string;
  name: string;
  /** Optional — only way to reach a payer if the event is called off. */
  email: string | null;
  amount_cents: number;
  status: "pledged" | "confirmed";
};

export type FundWithContributions = FundRow & {
  contributions: ContributionRow[];
};

export type JobWithSignups = JobRow & { signups: SignupRow[] };
export type EventWithJobs = EventRow & {
  jobs: JobWithSignups[];
  fund: FundWithContributions | null;
};
