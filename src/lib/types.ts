export type EventKind = "slots" | "sheet";

export type EventRow = {
  id: string;
  created_at: string;
  /** Jobs with limited slots, or a contribution sheet of names × columns. */
  kind: EventKind;
  name: string;
  description: string | null;
  event_at: string;
  /** IANA zone the event happens in. Null on pre-existing rows. */
  event_tz: string | null;
  /** Free text: a venue, an address, or "the church hall". */
  location: string | null;
  /** How long it runs. Needed for a calendar entry, which requires an end. */
  duration_minutes: number;
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

export type SheetColumnRow = {
  id: string;
  created_at: string;
  event_id: string;
  label: string;
  sort_order: number;
};

export type SheetRowRow = {
  id: string;
  created_at: string;
  event_id: string;
  name: string;
  note: string | null;
  /** Added from the public page rather than by the organizer. */
  self_added: boolean;
  sort_order: number;
};

/** A row with the ids of the columns it has ticked. */
export type SheetRowWithTicks = SheetRowRow & { ticks: string[] };

export type JobWithSignups = JobRow & { signups: SignupRow[] };
export type EventWithJobs = EventRow & {
  jobs: JobWithSignups[];
  fund: FundWithContributions | null;
  /** Empty for a slots event. */
  sheet_columns: SheetColumnRow[];
  sheet_rows: SheetRowWithTicks[];
};
