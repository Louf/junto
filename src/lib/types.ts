export type EventRow = {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  event_at: string;
  banner_path: string | null;
  creator_email: string;
  creator_user_id: string | null;
  edit_token: string;
  slug: string;
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

export type JobWithSignups = JobRow & { signups: SignupRow[] };
export type EventWithJobs = EventRow & { jobs: JobWithSignups[] };
