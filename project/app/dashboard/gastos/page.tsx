import { redirect } from "next/navigation";

export default function LegacyGastosPage() {
  redirect("/dashboard/expenses");
}
