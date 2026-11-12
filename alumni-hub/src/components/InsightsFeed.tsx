"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Eye, Loader2, Search, Trash2 } from "lucide-react";
import { useToast } from "./ToastProvider";

interface Insight {
  insight_id: number;
  title: string;
  content: string;
  published_at: string;
  view_count: number;
  author_name: string;
  current_company: string | null;
  job_title: string | null;
  skills_list: string | null;
}

export function InsightsFeed({
  canDelete = false,
  currentUserName,
}: {
  canDelete?: boolean;
  currentUserName?: string;
}) {
  const toast = useToast();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(searchTerm?: string) {
    setLoading(true);
    try {
      const url = searchTerm
        ? `/api/insights?search=${encodeURIComponent(searchTerm)}`
        : "/api/insights";
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInsights(data.insights || []);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    load();
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    load(search.trim() || undefined);
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/insights/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not remove insight.");
        return;
      }
      toast.success("Insight removed.");
      load(search.trim() || undefined);
    } catch {
      toast.error("Network error.");
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search insights (full-text: e.g. 'interview', 'cloud migration')"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {insights === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading insights...
        </p>
      ) : insights.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No career insights published yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {insights.map((ins) => (
            <li
              key={ins.insight_id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                  {ins.title}
                </p>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                  <Eye className="h-3 w-3" /> {ins.view_count}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                By {ins.author_name} — {ins.job_title} at {ins.current_company} ·{" "}
                {new Date(ins.published_at).toLocaleDateString()}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {ins.content}
              </p>
              {ins.skills_list && (
                <p className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400">
                  Tags: {ins.skills_list}
                </p>
              )}
              {canDelete && ins.author_name === currentUserName && (
                <button
                  type="button"
                  onClick={() => handleDelete(ins.insight_id)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
