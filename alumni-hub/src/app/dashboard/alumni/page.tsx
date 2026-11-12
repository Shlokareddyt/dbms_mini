import { redirect } from "next/navigation";
import { RowDataPacket } from "mysql2/promise";
import { Briefcase, CalendarCheck, FileText, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { Navbar } from "@/components/Navbar";

export const dynamic = "force-dynamic";

interface AlumniProfileRow extends RowDataPacket {
  alumni_id: number;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  grad_year: number | null;
  bio: string | null;
  mentee_capacity: number;
  is_verified_by_admin: number | boolean;
  is_verified: number | boolean;
}

export default async function AlumniDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "alumni") redirect(`/dashboard/${user.role}`);

  let profile: AlumniProfileRow | null = null;
  try {
    const rows = await query<AlumniProfileRow[]>(
      `SELECT
        a.alumni_id,
        a.current_company,
        a.job_title,
        a.industry,
        a.grad_year,
        a.bio,
        a.mentee_capacity,
        a.is_verified_by_admin,
        u.is_verified
       FROM alumni a
       INNER JOIN users u ON a.user_id = u.user_id
       WHERE a.user_id = ?
       LIMIT 1`,
      [user.userId]
    );
    profile = rows[0] ?? null;
  } catch {
    profile = null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Alumni Mentor Workspace
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome, {user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {profile?.job_title || "Mentor"} at{" "}
              {profile?.current_company || "Industry Partner"}
              {profile?.industry ? ` • ${profile.industry}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-slate-500 dark:text-slate-400">
                Available Mentee Slots:{" "}
              </span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {profile?.mentee_capacity ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              <Users className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Incoming Requests
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Phase 2 will let you accept/reject mentorship requests and schedule
              1:1 sessions inside transactions.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <FileText className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Publish Career Insights
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Share industry trends and interview guidance linked with skill tags
              in <code>career_insights</code>.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
              <Briefcase className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Bio &amp; Vector Sync
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Phase 3 will automatically re-embed your bio and industry into
              Qdrant whenever you update your mentor profile.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <CalendarCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold">Mentor Profile Summary</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {profile?.bio || "No bio set yet."}
          </p>
        </section>
      </main>
    </div>
  );
}

