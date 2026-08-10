import { EventCardPreview, type PreviewJob } from "@/components/EventCardPreview";

const JOBS: PreviewJob[] = [
  { id: "dessert", title: "Bring a dessert", capacity: 3, filled: 3 },
  { id: "tables", title: "Set up tables", capacity: 3, filled: 2 },
  { id: "cleanup", title: "Clean up crew", capacity: 3, filled: 1 },
];

const TOTAL = JOBS.reduce((n, j) => n + j.capacity, 0);
const FILLED = JOBS.reduce((n, j) => n + (j.filled ?? 0), 0);

/** Static preview of an event page, used to show the product on the homepage. */
export function SampleEventCard() {
  return (
    <EventCardPreview
      title="Thanksgiving potluck"
      dateLabel="Nov 27"
      jobs={JOBS}
      ctaHref="/create"
      ariaLabel={`Example Junto event: Thanksgiving potluck, ${FILLED} of ${TOTAL} slots filled across ${JOBS.length} jobs.`}
    />
  );
}

export default SampleEventCard;
