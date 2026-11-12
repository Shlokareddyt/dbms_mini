"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

interface LogRow {
  log_id: number;
  action_type: string;
  target_table: string;
  target_id: number;
  details: string | null;
  action_at: string;
  admin_name: string | null;
}

export function AuditLog() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/logs")
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => active && setLogs(data.logs || []))
      .catch(() => active && setLogs([]));
    return () => {
      active = false;
    };
  }, []);

  if (logs === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading audit trail...
      </p>
    );
  }

  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">No logged admin actions yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li
          key={l.log_id}
          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60"
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {l.action_type} — {l.target_table}#{l.target_id}
            </p>
            <p className="mt-0.5 text-slate-500">{l.details}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {l.admin_name || "system"} · {new Date(l.action_at).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
