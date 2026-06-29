"use server";

import { revalidatePath } from "next/cache";

import { auth, unstable_update as updateSession } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";

export type ProfileActionState = {
  status?: "success" | "error";
  message?: string;
};

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return normalizeText(value).toLowerCase();
}

function normalizeImage(value: FormDataEntryValue | null) {
  const image = normalizeText(value);
  if (!image) return null;
  try {
    const url = new URL(image);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  await dbConnect();
  return User.findOne({ email: session.user.email })
    .select("_id name email image")
    .lean<{ _id: { toString(): string }; name: string | null; email: string | null; image: string | null }>();
}

export async function updateProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const name = normalizeText(formData.get("name")) || null;
  const email = normalizeEmail(formData.get("email"));
  const image = normalizeImage(formData.get("image"));

  if (name && name.length > 80) return { status: "error", message: "O nome pode ter no maximo 80 caracteres." };
  if (!isValidEmail(email)) return { status: "error", message: "Informe um email valido." };
  if (image === "") return { status: "error", message: "Informe uma URL de avatar http ou https." };

  const userId = user._id.toString();

  if (email !== user.email) {
    const existingUser = await User.findOne({ email }).select("_id").lean<{ _id: { toString(): string } }>();
    if (existingUser && existingUser._id.toString() !== userId) {
      return { status: "error", message: "Este email ja esta em uso." };
    }
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { name, email, image } },
    { new: true, select: "name email image" },
  ).lean<{ name: string | null; email: string | null; image: string | null }>();

  if (!updatedUser) return { status: "error", message: "Nao foi possivel atualizar o perfil." };

  await updateSession({
    user: {
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return { status: "success", message: "Perfil atualizado." };
}
