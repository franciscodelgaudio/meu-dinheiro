"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type ProfileActionState } from "./actions";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
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

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState,
  );

  useEffect(() => {
    if (!state.status || !state.message) {
      return;
    }

    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
      return;
    }

    toast.error(state.message);
  }, [router, state]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Dados do perfil</CardTitle>
          <CardDescription>
            Atualize seu nome, email de exibicao e avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                defaultValue={user.name ?? ""}
                maxLength={80}
                placeholder="Seu nome"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                placeholder="voce@email.com"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="image">Avatar</Label>
            <Input
              id="image"
              name="image"
              type="url"
              defaultValue={user.image ?? ""}
              placeholder="https://exemplo.com/avatar.jpg"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Avatar atual</CardTitle>
            <CardDescription>Previa da sua conta no menu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
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
            </div>
            <div>
              <p className="font-medium">{user.name || "Sem nome"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
              {user.image ? <Camera /> : <UserRound />}
              {user.image ? "Avatar por URL" : "Iniciais como avatar"}
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
