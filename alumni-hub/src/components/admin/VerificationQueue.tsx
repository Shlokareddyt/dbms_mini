"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, UserCog } from "lucide-react";
import { useToast } from "../ToastProvider";

interface PendingUser {
  user_id: number;
  name: string;
  email: string;
  role: "student" | "alumni" | "admin";
  created_at: string;
  major: string | null;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
}

export function VerificationQueue({ onVerified }: { onVerified?: () => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<PendingUser[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?status=pending");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setUsers(data.users || []);
    } catch {
      // keep previous
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    load();
  }, [load]);

  async function verify(userId: number) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_verified: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not verify user.");
        return;
      }
      toast.success("User verified — trg_log_user_verification logged the action.");
      load();
      onVerified?.();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  if (users === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading verification queue...
      </p>
    );
  }

  if (users.length === 0) {
    return <p className="text-sm text-slate-500">No pending verifications. All caught up!</p>;
  }

  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <li
          key={u.user_id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60"
        >
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <UserCog className="h-3.5 w-3.5 text-indigo-500" />
              {u.name}{" "}
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {u.role}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {u.email} ·{" "}
              {u.role === "alumni"
                ? `${u.job_title || ""} at ${u.current_company || ""}`
                : u.major || ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => verify(u.user_id)}
            disabled={busyId === u.user_id}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {busyId === u.user_id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Verify
          </button>
        </li>
      ))}
    </ul>
  );
}
