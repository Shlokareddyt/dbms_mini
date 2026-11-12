"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Ban,
  Calendar,
  CheckCircle2,
  Loader2,
  Star,
  XCircle,
} from "lucide-react";
import { useToast } from "./ToastProvider";

interface MentorshipRow {
  request_id: number;
  request_status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  match_score: number | null;
  request_message: string | null;
  requested_at: string;
  student_name: string;
  student_major: string | null;
  alumni_name: string;
  current_company: string | null;
  job_title: string | null;
  remaining_capacity: number;
  session_id: number | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_link: string | null;
  session_status: "scheduled" | "completed" | "cancelled" | null;
  session_notes: string | null;
  feedback_rating: number | null;
  feedback_comments: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  completed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  cancelled: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function MentorshipRequestsPanel({ role }: { role: "student" | "alumni" }) {
  const toast = useToast();
  const [requests, setRequests] = useState<MentorshipRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [feedbackSessionId, setFeedbackSessionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mentorship-requests");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRequests(data.requests || []);
    } catch {
      // keep previous state on transient network errors
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    load();
  }, [load]);

  async function runAction(requestId: number, action: string) {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/mentorship-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || `Could not ${action} request.`);
        return;
      }
      toast.success(data.message || "Updated.");
      load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function scheduleSession(e: FormEvent<HTMLFormElement>, requestId: number) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusyId(requestId);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          scheduled_at: form.get("scheduled_at"),
          duration_minutes: Number(form.get("duration_minutes") || 30),
          meeting_link: form.get("meeting_link"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not schedule session.");
        return;
      }
      toast.success("Session scheduled.");
      setSchedulingId(null);
      load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function markCompleted(sessionId: number) {
    setBusyId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not mark session complete.");
        return;
      }
      toast.success("Session marked completed.");
      load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitFeedback(e: FormEvent<HTMLFormElement>, sessionId: number) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusyId(sessionId);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          rating: Number(form.get("rating") || 5),
          comments: form.get("comments"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not submit feedback.");
        return;
      }
      toast.success("Thanks for the feedback!");
      setFeedbackSessionId(null);
      load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  if (requests === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests...
      </p>
    );
  }

  if (requests.length === 0) {
    return <p className="text-sm text-slate-500">No mentorship requests yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li
          key={r.request_id}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {role === "student"
                ? `${r.alumni_name} · ${r.job_title || ""} at ${r.current_company || ""}`
                : `${r.student_name} · ${r.student_major || "Student"}`}
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[r.request_status]}`}
            >
              {r.request_status}
            </span>
          </div>

          {r.request_message && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              &ldquo;{r.request_message}&rdquo;
            </p>
          )}
          {r.match_score !== null && (
            <p className="mt-1 text-[11px] text-slate-500">
              Match score: {Math.round(Number(r.match_score) * 100)}%
            </p>
          )}

          {r.session_id && (
            <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/30">
              <p className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300">
                <Calendar className="h-3.5 w-3.5" />
                Session: {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : "TBD"} (
                {r.duration_minutes} min) — {r.session_status}
              </p>
              {r.meeting_link && (
                <a
                  href={r.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-indigo-600 underline dark:text-indigo-400"
                >
                  Join link
                </a>
              )}
              {r.feedback_rating !== null && (
                <p className="mt-1 flex items-center gap-1 text-amber-600">
                  <Star className="h-3 w-3 fill-current" /> {r.feedback_rating}/5 —{" "}
                  {r.feedback_comments || "No comments."}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {role === "alumni" && r.request_status === "pending" && (
              <>
                <ActionButton
                  busy={busyId === r.request_id}
                  icon={CheckCircle2}
                  label="Accept"
                  tone="emerald"
                  onClick={() => runAction(r.request_id, "accept")}
                />
                <ActionButton
                  busy={busyId === r.request_id}
                  icon={XCircle}
                  label="Reject"
                  tone="red"
                  onClick={() => runAction(r.request_id, "reject")}
                />
              </>
            )}

            {role === "alumni" && r.request_status === "accepted" && !r.session_id && (
              <ActionButton
                busy={false}
                icon={Calendar}
                label="Schedule Session"
                tone="indigo"
                onClick={() => setSchedulingId(r.request_id)}
              />
            )}

            {role === "alumni" &&
              r.session_id &&
              r.session_status === "scheduled" && (
                <ActionButton
                  busy={busyId === r.session_id}
                  icon={CheckCircle2}
                  label="Mark Completed"
                  tone="indigo"
                  onClick={() => markCompleted(r.session_id!)}
                />
              )}

            {role === "student" && ["pending", "accepted"].includes(r.request_status) && (
              <ActionButton
                busy={busyId === r.request_id}
                icon={Ban}
                label="Cancel"
                tone="slate"
                onClick={() => runAction(r.request_id, "cancel")}
              />
            )}

            {role === "student" &&
              r.session_id &&
              r.session_status === "completed" &&
              r.feedback_rating === null && (
                <ActionButton
                  busy={false}
                  icon={Star}
                  label="Leave Feedback"
                  tone="amber"
                  onClick={() => setFeedbackSessionId(r.session_id)}
                />
              )}
          </div>

          {schedulingId === r.request_id && (
            <form
              onSubmit={(e) => scheduleSession(e, r.request_id)}
              className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3"
            >
              <input
                type="datetime-local"
                name="scheduled_at"
                required
                className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                name="duration_minutes"
                defaultValue={30}
                min={15}
                max={240}
                className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="url"
                name="meeting_link"
                placeholder="https://meet.google.com/..."
                className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="col-span-full flex gap-2">
                <button
                  type="submit"
                  disabled={busyId === r.request_id}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setSchedulingId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {feedbackSessionId === r.session_id && r.session_id && (
            <form
              onSubmit={(e) => submitFeedback(e, r.session_id!)}
              className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <label className="flex items-center gap-2">
                Rating:
                <select
                  name="rating"
                  defaultValue={5}
                  className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                name="comments"
                rows={2}
                placeholder="How was the session?"
                className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackSessionId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActionButton({
  busy,
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  busy: boolean;
  icon: typeof CheckCircle2;
  label: string;
  tone: "emerald" | "red" | "indigo" | "slate" | "amber";
  onClick: () => void;
}) {
  const toneClasses: Record<string, string> = {
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    red: "bg-red-600 hover:bg-red-500",
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    slate: "bg-slate-600 hover:bg-slate-500",
    amber: "bg-amber-500 hover:bg-amber-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60 ${toneClasses[tone]}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
