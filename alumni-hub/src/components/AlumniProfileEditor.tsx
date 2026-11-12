"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useToast } from "./ToastProvider";

interface SkillOption {
  skill_id: number;
  name: string;
  category: string | null;
}

interface Props {
  initial: {
    currentCompany: string;
    jobTitle: string;
    industry: string;
    bio: string;
    menteeCapacity: number;
    skillIds: number[];
  };
  onSaved?: () => void;
}

export function AlumniProfileEditor({ initial, onSaved }: Props) {
  const toast = useToast();
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [currentCompany, setCurrentCompany] = useState(initial.currentCompany);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [industry, setIndustry] = useState(initial.industry);
  const [bio, setBio] = useState(initial.bio);
  const [menteeCapacity, setMenteeCapacity] = useState(initial.menteeCapacity);
  const [selected, setSelected] = useState<number[]>(initial.skillIds);
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/alumni/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_company: currentCompany.trim(),
          job_title: jobTitle.trim(),
          industry: industry.trim(),
          bio: bio.trim(),
          mentee_capacity: menteeCapacity,
          skill_ids: selected,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not update profile.");
        return;
      }
      if (data.vectorSynced) {
        toast.success("Profile updated & re-embedded into Qdrant.");
      } else if (data.vectorSearchConfigured === false) {
        toast.success("Profile updated. (Vector search not configured yet.)");
      } else {
        toast.success("Profile updated.");
      }
      onSaved?.();
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={currentCompany}
          onChange={(e) => setCurrentCompany(e.target.value)}
          placeholder="Current company"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Job title"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <input
          type="number"
          min={0}
          max={20}
          value={menteeCapacity}
          onChange={(e) => setMenteeCapacity(Number(e.target.value))}
          placeholder="Mentee capacity"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        placeholder="Mentorship bio (used for semantic matching)"
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
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
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Save &amp; Re-sync Vector
      </button>
      <p className="flex items-center gap-1 text-[11px] text-slate-500">
        <Save className="h-3 w-3" /> Saving updates MySQL immediately and re-embeds your bio into
        Qdrant in the background.
      </p>
    </form>
  );
}
