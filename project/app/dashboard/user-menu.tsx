"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type UserMenuProps = {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

function initials(name: string | null, email: string | null) {
  const source = name || email || "U";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Avatar({ user }: { user: UserMenuProps["user"] }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(user.name, user.email)
      )}
    </span>
  );
}

export function UserMenu({ user }: UserMenuProps) {
  const label = user.name || user.email || "Usuario";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={label}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar user={user} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{label}</span>
                {user.email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <Avatar user={user} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{label}</span>
                  {user.email ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserRound />
                Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                void signOut({ callbackUrl: "/" });
              }}
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
