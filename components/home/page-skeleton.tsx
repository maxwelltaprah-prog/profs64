import { Skeleton } from "@/components/ui/skeleton";

// Shown beside the persistent sidebar the instant a link is pressed, while the page itself renders on the server. Every
// route here renders per request, so without a loading boundary a click would show nothing until
// the data arrived. Boundaries also let Next prefetch this shell, which makes the switch immediate.
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 md:py-14">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
