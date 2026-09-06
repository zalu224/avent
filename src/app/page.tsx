import Link from "next/link";

const STEPS = [
  {
    title: "Post the flyer",
    body: "Snap the poster, the screenshot, the group-chat photo. Headcount reads the date, venue and lineup and fills the event in for you.",
  },
  {
    title: "It lands on your friends’ calendars",
    body: "Everyone who follows you sees the event where they’re already looking, sorted by night.",
  },
  {
    title: "See who’s in",
    body: "Tap “I’m in”, sort out rides in the thread, and keep a record of every show you’ve been to.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-display text-xl font-black tracking-tight">Headcount</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Create account
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-16 md:px-10">
        <section className="mx-auto mt-10 w-full max-w-4xl md:mt-20">
          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
            Who’s
            <br />
            going?
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-lilac-2 md:text-xl">
            Post a flyer for the concert, the rave, the club night. Headcount puts it on your
            friends’ calendars and shows you who’s in, so nobody goes alone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary px-6 py-3 text-base">
              Create account
            </Link>
            <Link href="/login" className="btn btn-outline px-6 py-3 text-base">
              Sign in
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-20 w-full max-w-4xl md:mt-28" aria-label="How it works">
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-plum-3 pt-5">
                <span className="font-display text-3xl font-black text-glow">{i + 1}</span>
                <h2 className="mt-3 font-display text-lg font-bold leading-snug">{step.title}</h2>
                <p className="mt-2 leading-relaxed text-lilac-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
