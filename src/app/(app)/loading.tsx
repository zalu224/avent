export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-8 h-8 w-40 rounded bg-edge" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-8 flex gap-4">
          <div className="h-16 w-16 rounded-lg bg-edge" />
          <div className="flex-1">
            <div className="h-5 w-2/3 rounded bg-edge" />
            <div className="mt-2 h-4 w-1/2 rounded bg-edge" />
            <div className="mt-2 h-4 w-1/3 rounded bg-edge" />
          </div>
        </div>
      ))}
    </div>
  );
}
