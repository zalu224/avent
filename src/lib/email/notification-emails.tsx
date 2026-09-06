import { Text } from "@react-email/components";
import { DateBlock, EmailButton, EmailLayout, Muted, Rule, styles } from "./layout";

type Person = { name: string; username: string };
type EventInfo = {
  id: string;
  title: string;
  month: string;
  day: string;
  weekday: string;
  when: string;
  where: string | null;
};

export function RsvpEmail({
  actor,
  event,
  goingCount,
  siteUrl,
}: {
  actor: Person;
  event: EventInfo;
  goingCount: number;
  siteUrl: string;
}) {
  const others = goingCount - 1;
  return (
    <EmailLayout
      preview={`${actor.name} is in for ${event.title}`}
      heading={`${actor.name} is in.`}
      siteUrl={siteUrl}
    >
      <Text style={styles.text}>
        <strong style={{ color: styles.heading.color }}>{actor.name}</strong> (@{actor.username}) said they’re going to your event.
        {others > 0 && ` That makes ${goingCount} going.`}
      </Text>
      <DateBlock
        month={event.month}
        day={event.day}
        weekday={event.weekday}
        title={event.title}
        detail={[event.when, event.where].filter(Boolean).join(" · ")}
      />
      <EmailButton href={`${siteUrl}/events/${event.id}`}>See who’s going</EmailButton>
      <Rule />
      <Muted>Sort out rides and meet-up spots in the plan thread on the event page.</Muted>
    </EmailLayout>
  );
}

export function NewFollowerEmail({ actor, siteUrl }: { actor: Person; siteUrl: string }) {
  return (
    <EmailLayout
      preview={`${actor.name} started following you on Headcount`}
      heading={`${actor.name} is following you.`}
      siteUrl={siteUrl}
    >
      <Text style={styles.text}>
        Every flyer you post now lands on their calendar. Follow them back to see what they’re going to.
      </Text>
      <EmailButton href={`${siteUrl}/u/${actor.username}`}>See their profile</EmailButton>
    </EmailLayout>
  );
}

export function CommentEmail({
  actor,
  event,
  body,
  siteUrl,
}: {
  actor: Person;
  event: EventInfo;
  body: string;
  siteUrl: string;
}) {
  return (
    <EmailLayout
      preview={`${actor.name} on ${event.title}: ${body.slice(0, 80)}`}
      heading={`${actor.name} added to the plan.`}
      siteUrl={siteUrl}
    >
      <DateBlock
        month={event.month}
        day={event.day}
        weekday={event.weekday}
        title={event.title}
        detail={[event.when, event.where].filter(Boolean).join(" · ")}
      />
      <Text
        style={{
          ...styles.text,
          color: styles.heading.color,
          borderLeft: `3px solid ${styles.link.color}`,
          paddingLeft: "12px",
          whiteSpace: "pre-line",
        }}
      >
        {body}
      </Text>
      <EmailButton href={`${siteUrl}/events/${event.id}#comments-heading`}>Reply in the thread</EmailButton>
    </EmailLayout>
  );
}
