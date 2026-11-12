"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, AlertTriangle } from "lucide-react";

type HealthState =
  | { status: "loading" }
  | { status: "connected"; database: string; tablesDetected: number }
  | { status: "error"; error: string };

export function DbHealthBadge() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.status === "connected") {
          setHealth({
            status: "connected",
            database: data.database,
            tablesDetected: data.tablesDetected,
          });
        } else {
          setHealth({
            status: "error",
            error: data.error || "MySQL connection not configured yet.",
          });
        }
      })
      .catch(() => {
        if (active) {
          setHealth({
            status: "error",
            error: "Unable to reach /api/health.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (health.status === "loading") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
        Checking MySQL connection...
      </div>
    );
  }

  if (health.status === "connected") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-800 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        MySQL Connected ({health.database} • {health.tablesDetected} tables)
      </div>
    );
  }

  return (
    <div
      title={health.error}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <Database className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        MySQL Pending Setup: {health.error}
      </span>
    </div>
  );
}

