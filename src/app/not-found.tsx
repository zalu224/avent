import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-bold">Nothing here</h1>
      <p className="mt-2 text-muted-2">That page doesn’t exist or was taken down.</p>
      <Link href="/feed" className="btn btn-primary mt-6">
        Back to the feed
      </Link>
    </div>
  );
}
