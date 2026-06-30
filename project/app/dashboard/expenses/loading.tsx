import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExpensesLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {/* Header */}
      <header>
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-2 h-7 w-32" />
      </header>

      {/* Quick expense input card */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Group summary chips */}
      <div className="flex flex-wrap gap-2">
        {[80, 96, 72, 88, 64].map((w, i) => (
          <Skeleton key={i} className={`h-8 w-${w === 80 ? '[80px]' : w === 96 ? '[96px]' : w === 72 ? '[72px]' : w === 88 ? '[88px]' : '[64px]'} rounded-full`} />
        ))}
      </div>

      {/* Expense table */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px] gap-3 border-b border-zinc-100 px-4 py-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_100px_80px] items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </main>
  );
}
