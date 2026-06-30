import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {/* Header + month navigator */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-7 w-44" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </header>

      {/* 3 metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="border-zinc-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}

        <Card className="col-span-2 border-zinc-200 shadow-sm sm:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-24" />
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </main>
  );
}
