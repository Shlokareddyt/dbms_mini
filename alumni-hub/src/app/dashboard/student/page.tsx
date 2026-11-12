import { redirect } from "next/navigation";
import { RowDataPacket } from "mysql2/promise";
import { BookOpen, Compass, Sparkles, UserCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { Navbar } from "@/components/Navbar";

export const dynamic = "force-dynamic";

interface StudentProfileRow extends RowDataPacket {
  student_id: number;
  major: string | null;
  grad_year: number | null;
  bio: string | null;
  career_goals: string | null;
  is_verified: number | boolean;
}

export default async function StudentDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect(`/dashboard/${user.role}`);

  let profile: StudentProfileRow | null = null;
  try {
    const rows = await query<StudentProfileRow[]>(
      `SELECT s.student_id, s.major, s.grad_year, s.bio, s.career_goals, u.is_verified
       FROM students s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.user_id = ?
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
              Student Workspace
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome, {user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {profile?.major || "Campus Student"}
              {profile?.grad_year ? ` • Class of ${profile.grad_year}` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-slate-500 dark:text-slate-400">
              Account Status:{" "}
            </span>
            <span
              className={
                profile?.is_verified
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-amber-600"
              }
            >
              {profile?.is_verified ? "Verified Student" : "Pending Admin Review"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Find a Mentor (Vector Search)
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Phase 3 will embed your natural-language query and retrieve the top
              3 alumni mentors from Qdrant.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                My Mentorship Requests
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Phase 2 will wire atomic MySQL transactions &amp;{" "}
              <code>Active_Mentorships_View</code> here.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
              <BookOpen className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Career Insights Feed
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Read verified alumni career advice tagged by technical skills and
              industries.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Compass className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold">Your Relational Profile</h2>
          </div>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Career Goals
              </p>
              <p className="mt-1 text-slate-800 dark:text-slate-200">
                {profile?.career_goals || "Not added yet."}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Bio
              </p>
              <p className="mt-1 text-slate-800 dark:text-slate-200">
                {profile?.bio || "Not added yet."}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

