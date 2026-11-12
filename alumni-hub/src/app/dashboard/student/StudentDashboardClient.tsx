"use client";

import { useState } from "react";
import { MentorSearch } from "@/components/MentorSearch";
import { AlumniDirectory } from "@/components/AlumniDirectory";
import { MentorshipRequestsPanel } from "@/components/MentorshipRequestsPanel";
import { InsightsFeed } from "@/components/InsightsFeed";

export function StudentDashboardClient({ mode }: { mode: "search" | "requests" | "insights" }) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode === "search") {
    return (
      <div className="space-y-6">
        <MentorSearch onRequested={() => setRefreshKey((k) => k + 1)} />
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Or browse the full directory
          </h3>
          <AlumniDirectory key={refreshKey} onRequested={() => setRefreshKey((k) => k + 1)} />
        </div>
      </div>
    );
  }

  if (mode === "requests") {
    return <MentorshipRequestsPanel role="student" />;
  }

  return <InsightsFeed />;
}
