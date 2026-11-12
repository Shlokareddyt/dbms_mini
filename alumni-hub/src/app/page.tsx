import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Database,
  Lock,
  Sparkles,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { DbHealthBadge } from "@/components/DbHealthBadge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect(`/dashboard/${user.role}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={null} />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Database className="h-3.5 w-3.5" />
              MySQL 8.0 Relational Core + Qdrant Vector Search
            </span>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Campus Alumni Mentorship &amp; Career Insights Hub
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Connect with verified alumni mentors through atomic relational
              session scheduling, curated industry insights, and natural-language
              semantic mentor discovery.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 sm:w-auto"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Sign In to Dashboard
              </Link>
            </div>

            <div className="mt-6 flex justify-center">
              <DbHealthBadge />
            </div>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                Role-Based Security
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Bcrypt password hashing and HTTP-only JWT sessions protecting
                distinct Student, Alumni, and Admin workflows.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                Transactional Booking
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                ACID MySQL transactions coordinate mentorship requests,
                capacity limits, SQL Views, Triggers, and Stored Procedures.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                Semantic Mentor Search
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Gemini embeddings indexed in Qdrant match student learning goals
                with top alumni mentors using cosine similarity.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
