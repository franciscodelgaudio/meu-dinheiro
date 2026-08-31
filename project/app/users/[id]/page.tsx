import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Usuário</CardTitle>
          <CardDescription className="break-all">{id}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href={`/users/${id}/groups`} className={cn(buttonVariants({ variant: "outline" }))}>
            Grupos
          </Link>
          <Link href={`/users/${id}/cashflows`} className={cn(buttonVariants({ variant: "outline" }))}>
            Criar lançamento
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
