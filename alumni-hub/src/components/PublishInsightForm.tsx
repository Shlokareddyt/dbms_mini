"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useToast } from "./ToastProvider";

interface SkillOption {
  skill_id: number;
  name: string;
  category: string | null;
}

export function PublishInsightForm({ onPublished }: { onPublished?: () => void }) {
  const toast = useToast();
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => (res.ok ? res.json() : { skills: [] }))
      .then((data) => setSkills(data.skills || []))
      .catch(() => setSkills([]));
  }, []);

  function toggleSkill(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 5 || content.trim().length < 30) {
      toast.error("Title needs 5+ characters and content needs 30+ characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), skill_ids: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not publish insight.");
        return;
      }
      toast.success("Career insight published!");
      setTitle("");
      setContent("");
      setSelected([]);
      onPublished?.();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. 'How I prepared for system design interviews')"
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Share the insight, advice, or trend..."
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
      />
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <button
              type="button"
              key={s.skill_id}
              onClick={() => toggleSkill(s.skill_id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                selected.includes(s.skill_id)
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Publish
      </button>
    </form>
  );
}
