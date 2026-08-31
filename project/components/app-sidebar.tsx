"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon, HomeIcon, UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const currentUserId = params.id;
  const [userIdInput, setUserIdInput] = useState("");

  function handleGoToUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (userIdInput.trim()) {
      router.push(`/users/${userIdInput.trim()}`);
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="px-2 py-1 text-sm font-semibold">Meu Dinheiro</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/"} render={<Link href="/" />}>
                  <HomeIcon />
                  <span>Início</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/users/new"}
                  render={<Link href="/users/new" />}
                >
                  <UserPlusIcon />
                  <span>Novo usuário</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Usuário</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2 px-2">
            <form onSubmit={handleGoToUser} className="flex gap-1.5">
              <Input
                value={userIdInput}
                onChange={(event) => setUserIdInput(event.target.value)}
                placeholder="ID do usuário"
                className="h-7 text-xs"
              />
              <Button type="submit" size="icon-sm" variant="outline" aria-label="Ir para usuário">
                <ArrowRightIcon />
              </Button>
            </form>

            {currentUserId && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === `/users/${currentUserId}`}
                    render={<Link href={`/users/${currentUserId}`} />}
                  >
                    <span>Visão geral</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === `/users/${currentUserId}/groups`}
                    render={<Link href={`/users/${currentUserId}/groups`} />}
                  >
                    <span>Grupos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === `/users/${currentUserId}/cashflows`}
                    render={<Link href={`/users/${currentUserId}/cashflows`} />}
                  >
                    <span>Lançamentos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
