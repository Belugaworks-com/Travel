import { Logo } from "./logo";

export function AppHeaderSkeleton() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      <Logo />
      <div className="ml-auto hidden h-8 w-72 animate-pulse rounded-md bg-muted md:block" />
      <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
    </header>
  );
}
