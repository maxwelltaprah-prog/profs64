import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row" aria-busy="true">
      <div className="border-hairline hidden w-64 shrink-0 flex-col gap-2 border-r p-3 md:flex">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-4 h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 md:pt-20">
        <Skeleton className="mx-auto h-9 w-2/3" />
        <Skeleton className="mt-7 h-36 w-full rounded-xl" />
        <div className="mt-14 grid gap-2 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
