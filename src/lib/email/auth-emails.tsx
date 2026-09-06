import { Text } from "@react-email/components";
import { EmailButton, EmailLayout, Muted, styles } from "./layout";

/**
 * Supabase Auth email templates. Rendered to static HTML by
 * scripts/render-auth-emails.tsx with Go template placeholders such as
 * {{ .TokenHash }} left in place for Supabase to fill in.
 */

type Props = { url: string; siteUrl: string };

export function ConfirmSignupEmail({ url, siteUrl }: Props) {
  return (
    <EmailLayout
      preview="One tap and you’re on the list."
      heading="You’re almost on the list."
      siteUrl={siteUrl}
      footerNote="You’re getting this because someone signed up for Headcount with this address."
    >
      <Text style={styles.text}>
        Confirm your email to start following friends, posting flyers, and seeing who’s in.
      </Text>
      <EmailButton href={url}>Confirm my email</EmailButton>
      <Muted>
        Didn’t create a Headcount account? You can ignore this and nothing will happen.
      </Muted>
    </EmailLayout>
  );
}

export function MagicLinkEmail({ url, siteUrl }: Props) {
  return (
    <EmailLayout
      preview="Your sign-in link for Headcount."
      heading="Here’s your sign-in link."
      siteUrl={siteUrl}
    >
      <Text style={styles.text}>Tap below to sign in. The link works once and expires soon.</Text>
      <EmailButton href={url}>Sign in to Headcount</EmailButton>
      <Muted>If you didn’t ask for this, ignore it. Nobody can sign in without the link.</Muted>
    </EmailLayout>
  );
}

export function ResetPasswordEmail({ url, siteUrl }: Props) {
  return (
    <EmailLayout
      preview="Choose a new password for Headcount."
      heading="Let’s reset your password."
      siteUrl={siteUrl}
    >
      <Text style={styles.text}>
        Tap below to choose a new password. This link expires soon and only works once.
      </Text>
      <EmailButton href={url}>Choose a new password</EmailButton>
      <Muted>If you didn’t ask to reset your password, you can ignore this.</Muted>
    </EmailLayout>
  );
}

export function ChangeEmailEmail({ url, siteUrl, newEmail }: Props & { newEmail: string }) {
  return (
    <EmailLayout
      preview="Confirm your new email for Headcount."
      heading="Confirm your new email."
      siteUrl={siteUrl}
    >
      <Text style={styles.text}>
        You asked to move your Headcount account to <strong style={{ color: styles.heading.color }}>{newEmail}</strong>.
        Confirm it to finish the switch.
      </Text>
      <EmailButton href={url}>Confirm new email</EmailButton>
      <Muted>If this wasn’t you, ignore this email and your address stays the same.</Muted>
    </EmailLayout>
  );
}
