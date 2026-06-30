import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";

import { AppSidebar } from "./app-sidebar";
import { NavProgress } from "@/components/ui/nav-progress";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  await dbConnect();
  const dbUser = await User.findOne({ email: session.user.email })
    .select("_id name email image")
    .lean<{ _id: { toString(): string }; name: string | null; email: string | null; image: string | null }>();

  if (!dbUser) {
    redirect("/login");
  }

  const financeProfile = await UserFinanceProfile.findOne({ userId: dbUser._id.toString() })
    .select("_id")
    .lean();

  if (!financeProfile) {
    redirect("/first-access");
  }

  const user = {
    name: dbUser.name,
    email: dbUser.email,
    image: dbUser.image,
  };

  return (
    <SidebarProvider>
      <NavProgress />
      <AppSidebar user={user} />
      <SidebarInset className="bg-muted/30">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <SidebarTrigger className="text-zinc-500 hover:text-zinc-800" />
          <div className="h-4 w-px bg-zinc-200" />
          <span className="text-sm font-bold tracking-tight text-zinc-950">
            Meu<span className="text-emerald-600">Dinheiro</span>
          </span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
