import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { prisma } from "@/lib/prisma";

import { AppSidebar } from "./app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true, image: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="bg-muted/30">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <SidebarTrigger />
          <div className="h-4 w-px bg-border" />
          <p className="text-sm font-medium text-muted-foreground">
            MeuDinheiro
          </p>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
