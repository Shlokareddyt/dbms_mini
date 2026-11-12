"use client";

import { FormEvent, useState } from "react";
import { Loader2, Search, Sparkles, UserPlus } from "lucide-react";
import { useToast } from "./ToastProvider";

interface MentorMatch {
  alumni_id: number;
  name: string;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  bio: string | null;
  mentee_capacity: number;
  skills_list: string | null;
  match_score: number;
}

export function MentorSearch({ onRequested }: { onRequested?: () => void }) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [matches, setMatches] = useState<MentorMatch[] | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length < 5) {
      toast.error("Describe what you're looking for in at least 5 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), top_k: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setConfigured(false);
        setMatches([]);
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Semantic search failed.");
        return;
      }
      setConfigured(true);
      setMatches(data.matches || []);
      if ((data.matches || []).length === 0) {
        toast.info("No mentors matched that query yet.");
      }
    } catch {
      toast.error("Network error while searching for mentors.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequest(alumniId: number, matchScore: number) {
    setRequestingId(alumniId);
    try {
      const res = await fetch("/api/mentorship-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          match_score: matchScore,
          message: `Found via semantic search: "${searchQuery.trim()}"`,
        }),
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

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g. backend engineer who can mentor me on system design and interview prep"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {!configured && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
          Semantic search isn&apos;t configured on this deployment yet — set{" "}
          <code>GEMINI_API_KEY</code> and <code>QDRANT_URL</code> in{" "}
          <code>alumni-hub/.env.local</code>, run Qdrant, then re-seed. Browse the
          alumni directory instead.
        </p>
      )}

      {matches && matches.length > 0 && (
        <ul className="mt-4 space-y-3">
          {matches.map((m) => (
            <li
              key={m.alumni_id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    {m.name}
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {Math.round(m.match_score * 100)}% match
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {m.job_title} at {m.current_company} · {m.industry}
                  </p>
                  {m.skills_list && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                      {m.skills_list}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {m.bio}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequest(m.alumni_id, m.match_score)}
                  disabled={requestingId === m.alumni_id || m.mentee_capacity <= 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  title={m.mentee_capacity <= 0 ? "No open mentee slots" : "Request mentorship"}
                >
                  {requestingId === m.alumni_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {m.mentee_capacity <= 0 ? "Full" : "Request"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
