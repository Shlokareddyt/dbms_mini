"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useToast } from "./ToastProvider";

interface AlumniRow {
  alumni_id: number;
  name: string;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  mentee_capacity: number;
  skills_list: string | null;
}

export function AlumniDirectory({ onRequested }: { onRequested?: () => void }) {
  const toast = useToast();
  const [alumni, setAlumni] = useState<AlumniRow[] | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/alumni")
      .then((res) => (res.ok ? res.json() : { alumni: [] }))
      .then((data) => {
        if (active) setAlumni(data.alumni || []);
      })
      .catch(() => active && setAlumni([]));
    return () => {
      active = false;
    };
  }, []);

  async function handleRequest(alumniId: number) {
    setRequestingId(alumniId);
    try {
      const res = await fetch("/api/mentorship-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not send mentorship request.");
        return;
      }
      toast.success("Mentorship request sent!");
      onRequested?.();
    } catch {
      toast.error("Network error while sending the request.");
    } finally {
      setRequestingId(null);
    }
  }

  if (alumni === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading alumni directory...
      </p>
    );
  }

  if (alumni.length === 0) {
    return <p className="text-sm text-slate-500">No verified mentors yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {alumni.map((a) => (
        <li
          key={a.alumni_id}
          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
        >
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              {a.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {a.job_title} at {a.current_company} · {a.industry}
            </p>
            {a.skills_list && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{a.skills_list}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleRequest(a.alumni_id)}
            disabled={requestingId === a.alumni_id || a.mentee_capacity <= 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {requestingId === a.alumni_id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {a.mentee_capacity <= 0 ? "Full" : "Request"}
          </button>
        </li>
      ))}
    </ul>
  );
}
