import Link from "next/link";
import { eventEmoji } from "@/lib/emoji";
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
      <h2 id="recommendations-title" className="display text-3xl">
        {title}
      </h2>
      {context.level === null && (
        <p className="text-sm text-muted-foreground">
          <Link href="/profile#level" className="font-semibold text-primary underline-offset-4 hover:underline">
            Set your level
          </Link>{" "}
          for better picks.
        </p>
      )}
      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        // A sideways strip of glass tiles; the -mx/px lets them scroll to the screen edge
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none]">
          {picks.map(({ event, reason }) => (
            <li key={event.id} className="glass w-60 shrink-0 snap-start rounded-3xl p-4">
              <Link href={`/#event-${event.id}`} className="flex flex-col gap-2">
                <span aria-hidden className="sticker text-3xl leading-none">
                  {eventEmoji(event.session_type, event.venue.category)}
                </span>
                <span className="display text-xl">{event.activity}</span>
                <span className="text-sm text-muted-foreground">
                  {formatWhen(event.starts_at)} · {formatPeso(event.price_per_person)}
                </span>
                <span className="text-sm font-semibold text-primary">{reason}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
