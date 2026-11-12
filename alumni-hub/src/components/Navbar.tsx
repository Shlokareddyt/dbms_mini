"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  Clock,
  GraduationCap,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "./ToastProvider";
import type { SessionPayload } from "@/lib/auth";

interface NavbarProps {
  user: SessionPayload | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Failed to sign out.");
      toast.success("You have been signed out.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out cleanly. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 text-slate-900 dark:text-white"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <span className="block text-base font-bold tracking-tight">
              AlumniHub
            </span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Mentorship &amp; Insights
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:flex dark:border-slate-800 dark:bg-slate-900">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user.name}
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {user.role}
                </span>
                {user.isVerified ? (
                  <span
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                    title="Verified account"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                    title="Pending admin verification"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Pending
                  </span>
                )}
              </div>

              {user.role === "admin" && (
                <Link
                  href="/dashboard/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Admin
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

