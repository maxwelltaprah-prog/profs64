import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 md:pt-20">
      <Skeleton className="mx-auto h-9 w-2/3" />
      <Skeleton className="mt-7 h-36 w-full rounded-xl" />
      <div className="mt-14 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
