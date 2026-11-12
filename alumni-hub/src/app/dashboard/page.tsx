import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardRouterPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  redirect(`/dashboard/${user.role}`);
}

