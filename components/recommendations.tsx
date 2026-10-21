import Link from "next/link";
import { formatPeso, formatWhen } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { recommend, type RecommendationContext } from "@/lib/recommend";

type Props = {
  events: FeedEvent[];
  context: RecommendationContext;
  limit: number;
  title: string;
  // The profile shows a message when nothing scores; the feed strip hides instead
  emptyText?: string;
};

// Used on the profile (top 5) and as the feed's "For you" strip (top 3)
export function Recommendations({ events, context, limit, title, emptyText }: Props) {
  const picks = recommend(events, context, limit);
  if (picks.length === 0 && !emptyText) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="recommendations-title">
      <h2 id="recommendations-title" className="text-lg font-semibold">
        {title}
      </h2>
      {context.level === null && (
        <p className="text-sm text-muted-foreground">
          <Link href="/profile#level" className="underline underline-offset-4">
            Set your level
          </Link>{" "}
          for better picks.
        </p>
      )}
      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {picks.map(({ event, reason }) => (
            <li key={event.id} className="flex flex-col gap-1 p-3">
              <Link href={`/#event-${event.id}`} className="font-medium underline-offset-4 hover:underline">
                {event.activity}
              </Link>
              <p className="text-sm text-muted-foreground">
                {event.venue.name} · {formatWhen(event.starts_at)} · {formatPeso(event.price_per_person)}
              </p>
              <p className="text-sm text-primary">{reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
