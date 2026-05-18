"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function UserMenu({ user }: UserMenuProps) {
  const label = user.name || user.email || "Usuario";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 justify-start gap-3 px-3">
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
          <span className="hidden max-w-44 min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-medium">{label}</span>
            {user.email ? (
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            ) : null}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate">{label}</span>
          {user.email ? (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          ) : null}
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
  );
}
