import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Link href="/" className="font-display text-2xl font-black tracking-tight">
        Headcount
      </Link>
      <div className="mt-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
