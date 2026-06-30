import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DebtsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {/* Header */}
      <header>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-7 w-44" />
      </header>

      {/* Month nav */}
      <Skeleton className="h-9 w-36 rounded-lg" />

      {/* Summary card */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-28" />
        </CardContent>
      </Card>

      {/* Debt list */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="ml-auto h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
