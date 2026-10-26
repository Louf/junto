type Props = {
  title: string;
  /** Rendered muted when the title is a stand-in for empty input. */
  titleIsPlaceholder?: boolean;
  dateLabel?: string | null;
  columns: string[];
  names: string[];
  /** Whole card is announced as one image with this label. */
  ariaLabel: string;
};

const SHOWN_ROWS = 6;

/** The contribution-sheet counterpart to EventCardPreview, for the create form. */
export function SheetPreview({
  title,
  titleIsPlaceholder = false,
  dateLabel,
  columns,
  names,
  ariaLabel,
}: Props) {
  const shown = names.slice(0, SHOWN_ROWS);
  const more = names.length - shown.length;
  const labels = columns.length > 0 ? columns : ["…"];

  return (
    <div
      className="w-full rounded-3xl border border-border bg-card p-5 lg:p-6"
      role="img"
      aria-label={ariaLabel}
    >
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className={`truncate text-[17px] font-semibold leading-tight ${
              titleIsPlaceholder ? "text-muted" : ""
            }`}
          >
            {title}
          </h2>
          {dateLabel && (
            <span className="shrink-0 text-[12px] text-muted tabular-nums">
              {dateLabel}
            </span>
          )}
        </div>

        <p className="-mt-2 text-[13px] text-muted tabular-nums">
          {names.length} {names.length === 1 ? "person" : "people"} ·{" "}
          {columns.length} {columns.length === 1 ? "way" : "ways"} to help
        </p>

        <div
          className="grid items-center gap-x-2 gap-y-2.5 text-[13px]"
          style={{
            gridTemplateColumns: `minmax(0,1fr) repeat(${labels.length}, 2.75rem)`,
          }}
        >
          <span />
          {labels.map((label, i) => (
            <span
              key={i}
              className="truncate text-center text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              {label}
            </span>
          ))}

          {shown.length === 0 ? (
            <span
              className="col-span-full rounded-2xl border border-dashed border-border px-4 py-5 text-center text-[13px] text-muted"
            >
              Add names and they&rsquo;ll show up here.
            </span>
          ) : (
            shown.map((name, r) => (
              <Row key={r} name={name} count={labels.length} />
            ))
          )}
        </div>

        {more > 0 && (
          <p className="-mt-1 text-[12px] text-muted">
            +{more} more
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ name, count }: { name: string; count: number }) {
  return (
    <>
      <span className="truncate font-medium">{name}</span>
      {Array.from({ length: count }, (_, c) => (
        <span
          key={c}
          className="mx-auto size-5 rounded-md border-[1.5px] border-foreground/20"
        />
      ))}
    </>
  );
}
