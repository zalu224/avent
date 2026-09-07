import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Brand tokens mirrored from globals.css (light theme). Email clients need
 * literal values, so the names here map: ink=page, plum=card, plum2/3=borders,
 * lilac/lilac2=secondary text, cream=primary text.
 */
export const brand = {
  ink: "#0b1020",
  plum: "#121a2f",
  plum2: "#1f2a47",
  plum3: "#2d3d66",
  lilac: "#8b9bc7",
  lilac2: "#b8c5e6",
  cream: "#eef2ff",
  flare: "#3d7cff",
  glow: "#8ec5ff",
} as const;

export const displayFont =
  '"Unbounded", "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const bodyFont = '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const styles = {
  body: {
    backgroundColor: brand.ink,
    margin: 0,
    padding: "32px 12px",
    fontFamily: bodyFont,
    color: brand.cream,
  },
  container: {
    maxWidth: "520px",
    margin: "0 auto",
  },
  wordmark: {
    fontFamily: displayFont,
    fontSize: "20px",
    fontWeight: 900 as const,
    letterSpacing: "-0.02em",
    color: brand.cream,
    margin: "0 0 20px",
  },
  card: {
    backgroundColor: brand.plum,
    border: `1px solid ${brand.plum2}`,
    borderRadius: "16px",
    padding: "28px 28px 24px",
  },
  heading: {
    fontFamily: displayFont,
    fontSize: "26px",
    lineHeight: "1.15",
    fontWeight: 700 as const,
    color: brand.cream,
    margin: "0 0 12px",
  },
  text: {
    fontSize: "16px",
    lineHeight: "1.55",
    color: brand.lilac2,
    margin: "0 0 16px",
  },
  small: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: brand.lilac,
    margin: "16px 0 0",
  },
  button: {
    backgroundColor: brand.flare,
    color: "#ffffff",
    fontFamily: bodyFont,
    fontSize: "15px",
    fontWeight: 700 as const,
    borderRadius: "999px",
    padding: "12px 22px",
    textDecoration: "none",
    display: "inline-block",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    color: brand.cream,
    fontFamily: bodyFont,
    fontSize: "15px",
    fontWeight: 600 as const,
    borderRadius: "999px",
    padding: "11px 20px",
    textDecoration: "none",
    display: "inline-block",
    border: `1px solid ${brand.plum3}`,
  },
  hr: {
    borderColor: brand.plum2,
    margin: "20px 0",
  },
  footer: {
    fontSize: "12px",
    lineHeight: "1.5",
    color: brand.lilac,
    margin: "20px 0 0",
    textAlign: "center" as const,
  },
  link: {
    color: brand.flare,
    textDecoration: "underline",
  },
} as const;

export function EmailLayout({
  preview,
  heading,
  children,
  siteUrl,
  footerNote,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
  siteUrl: string;
  footerNote?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.wordmark}>Headcount</Text>
          <Section style={styles.card}>
            <Heading as="h1" style={styles.heading}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Text style={styles.footer}>
            {footerNote ?? "You’re getting this because you have a Headcount account."}
            <br />
            <Link href={siteUrl} style={{ color: brand.lilac, textDecoration: "none" }}>
              Headcount · Who’s going?
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Button href={href} style={secondary ? styles.buttonSecondary : styles.button}>
      {children}
    </Button>
  );
}

/** Flyer-style date block, table-based so it survives every email client. */
export function DateBlock({
  month,
  day,
  weekday,
  title,
  detail,
}: {
  month: string;
  day: string;
  weekday: string;
  title: string;
  detail?: string;
}) {
  return (
    <table cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: "4px 0 18px" }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: "top", paddingRight: "14px" }}>
            <table
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={{
                backgroundColor: brand.glow,
                borderRadius: "10px",
                width: "64px",
                height: "64px",
                textAlign: "center",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: "6px 4px 2px", fontSize: "11px", fontWeight: 700, color: brand.ink, textTransform: "uppercase", fontFamily: bodyFont }}>
                    {month}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: displayFont, fontSize: "26px", fontWeight: 900, lineHeight: "1", color: brand.ink }}>
                    {day}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 4px 6px", fontSize: "11px", fontWeight: 600, color: brand.ink, fontFamily: bodyFont }}>
                    {weekday}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Text style={{ ...styles.text, margin: "0 0 4px", color: brand.cream, fontWeight: 700 }}>{title}</Text>
            {detail && <Text style={{ ...styles.text, margin: 0, fontSize: "14px" }}>{detail}</Text>}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.small}>{children}</Text>;
}

export function Rule() {
  return <Hr style={styles.hr} />;
}
