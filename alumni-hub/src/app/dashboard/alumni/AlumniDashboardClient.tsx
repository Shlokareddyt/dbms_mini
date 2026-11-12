"use client";

import { useState } from "react";
import { MentorshipRequestsPanel } from "@/components/MentorshipRequestsPanel";
import { PublishInsightForm } from "@/components/PublishInsightForm";
import { AlumniProfileEditor } from "@/components/AlumniProfileEditor";
import { InsightsFeed } from "@/components/InsightsFeed";

interface Props {
  mode: "requests" | "publish" | "profile" | "myInsights";
  initialProfile?: {
    currentCompany: string;
    jobTitle: string;
    industry: string;
    bio: string;
    menteeCapacity: number;
    skillIds: number[];
  };
  currentUserName?: string;
}

export function AlumniDashboardClient({ mode, initialProfile, currentUserName }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode === "requests") {
    return <MentorshipRequestsPanel role="alumni" />;
  }

  if (mode === "publish") {
    return <PublishInsightForm onPublished={() => setRefreshKey((k) => k + 1)} />;
  }

  if (mode === "profile" && initialProfile) {
    return <AlumniProfileEditor initial={initialProfile} />;
  }

  if (mode === "myInsights") {
    return (
      <InsightsFeed key={refreshKey} canDelete currentUserName={currentUserName} />
    );
  }

  return null;
}
