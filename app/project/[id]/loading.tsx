import { Skeleton } from "@/components/ui/skeleton";

// Shown while the project, its files and messages load. Mirrors the workspace layout so the
// real content replaces it in place rather than jumping.
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden" aria-busy="true">
      <div className="border-hairline flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="border-hairline flex w-[38%] flex-col border-r">
          <div className="border-hairline h-9 border-b px-4 py-2.5">
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="p-3">
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="border-hairline flex h-9 items-center gap-4 border-b px-4">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="border-hairline flex w-48 flex-col gap-2 border-r p-3">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="ml-4 h-4 w-24" />
              <Skeleton className="ml-4 h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
