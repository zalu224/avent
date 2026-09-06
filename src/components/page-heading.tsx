export function PageHeading({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-lilac">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
