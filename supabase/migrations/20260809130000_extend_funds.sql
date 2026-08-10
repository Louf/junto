-- Junto: goal and split fund modes
--
-- Written as ALTERs rather than edits to the original migration so this is
-- safe whether or not 20260809120000_add_funds.sql has already been applied.

-- The recipient isn't always the person who fronted the cost. In reimburse
-- mode they are; in goal and split they're just whoever is collecting.
alter table public.funds rename column payer_name to recipient_name;

-- Split mode divides a total across a number of people. Nullable because the
-- other two modes don't use it.
alter table public.funds add column if not exists headcount int check (headcount > 0);

-- Without this there is no way to contact someone who sent money — not to
-- confirm receipt, and not to warn them if the event is called off. Optional,
-- because requiring it would push people back toward an account.
alter table public.contributions add column if not exists email citext;
