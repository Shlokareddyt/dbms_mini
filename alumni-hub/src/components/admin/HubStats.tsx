"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Kpis {
  total_students: number;
  total_alumni: number;
  verified_alumni: number;
  pending_verifications: number;
  total_requests: number;
  pending_requests: number;
  active_sessions: number;
  completed_sessions: number;
  total_insights: number;
  avg_session_rating: number | null;
}

interface SkillStat {
  skill_name: string;
  category: string | null;
  alumni_count: number;
  student_count: number;
  total_mentions: number;
}

interface IndustryStat {
  industry: string;
  mentor_count: number;
  total_open_slots: number;
}

export function HubStats() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [topSkills, setTopSkills] = useState<SkillStat[]>([]);
  const [industries, setIndustries] = useState<IndustryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setKpis(data.kpis);
        setTopSkills(data.topSkills || []);
        setIndustries(data.industryCapacity || []);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Running CALL sp_get_hub_stats()...
      </p>
    );
  }

  if (!kpis) {
    return <p className="text-sm text-slate-500">Stats unavailable.</p>;
  }

  const kpiItems: Array<[string, number | string]> = [
    ["Students", kpis.total_students],
    ["Alumni", kpis.total_alumni],
    ["Verified Alumni", kpis.verified_alumni],
    ["Pending Verifications", kpis.pending_verifications],
    ["Total Requests", kpis.total_requests],
    ["Pending Requests", kpis.pending_requests],
    ["Active Sessions", kpis.active_sessions],
    ["Completed Sessions", kpis.completed_sessions],
    ["Career Insights", kpis.total_insights],
    ["Avg. Session Rating", kpis.avg_session_rating ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpiItems.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/60"
          >
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {topSkills.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top Skills (alumni + student demand)
          </h3>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-1.5">Skill</th>
                <th className="pb-1.5">Category</th>
                <th className="pb-1.5">Alumni</th>
                <th className="pb-1.5">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {topSkills.map((s) => (
                <tr key={s.skill_name}>
                  <td className="py-1.5 font-medium text-slate-800 dark:text-slate-200">
                    {s.skill_name}
                  </td>
                  <td className="py-1.5 text-slate-500">{s.category}</td>
                  <td className="py-1.5 text-slate-500">{s.alumni_count}</td>
                  <td className="py-1.5 text-slate-500">{s.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {industries.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Industry Mentorship Capacity
          </h3>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-1.5">Industry</th>
                <th className="pb-1.5">Mentors</th>
                <th className="pb-1.5">Open Slots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {industries.map((i) => (
                <tr key={i.industry}>
                  <td className="py-1.5 font-medium text-slate-800 dark:text-slate-200">
                    {i.industry}
                  </td>
                  <td className="py-1.5 text-slate-500">{i.mentor_count}</td>
                  <td className="py-1.5 text-slate-500">{i.total_open_slots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
