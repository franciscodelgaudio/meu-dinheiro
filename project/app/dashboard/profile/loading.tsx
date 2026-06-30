import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <header>
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-2 h-8 w-28" />
      </header>

      {/* Profile form card */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-3 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>

          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}

          <Skeleton className="h-9 w-24 rounded-md" />
        </CardContent>
      </Card>

      {/* Finance profile card */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1 h-3 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}

          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>

          <Skeleton className="h-9 w-24 rounded-md" />
        </CardContent>
      </Card>
    </main>
  );
}
