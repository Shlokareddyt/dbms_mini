import { redirect } from "next/navigation";
import { BarChart3, ShieldCheck, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import { HubStats } from "@/components/admin/HubStats";
import { AuditLog } from "@/components/admin/AuditLog";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(`/dashboard/${user.role}`);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Administration &amp; Governance
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Control Center
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Verify users (invoking <code>trg_log_user_verification</code>) and
            inspect platform analytics via <code>sp_get_hub_stats()</code>.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <Users className="h-5 w-5" />
              <h2 className="font-semibold">User Verification Queue</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Toggling <code>users.is_verified</code> triggers automated audit
              logging into <code>admin_actions_log</code>.
            </p>
            <div className="mt-4">
              <VerificationQueue />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-violet-600">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-semibold">Audit Trail</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Live feed of trigger-inserted records from{" "}
              <code>admin_actions_log</code>.
            </p>
            <div className="mt-4">
              <AuditLog />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 text-emerald-600">
            <BarChart3 className="h-5 w-5" />
            <h2 className="font-semibold">Stored Procedure Metrics</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Multi-result-set analytics from <code>CALL sp_get_hub_stats()</code>.
          </p>
          <div className="mt-4">
            <HubStats />
          </div>
        </section>
      </main>
    </div>
  );
}
