// =============================================
// STSphera Telegram Bot — Callback Action Parser
// =============================================
export type ParsedCallbackAction =
  | { type: "my_tasks" }
  | { type: "my_tasks_filter"; filter: "all" | "assigned" | "progress" | "overdue" | "done" }
  | { type: "enter_fact" }
  | { type: "report_defect" }
  | { type: "open_app" }
  | { type: "summary" }
  | { type: "setup_demo" }
  | { type: "main_menu" }
  | { type: "role_action"; action: string }
  // Task lifecycle
  | { type: "task_detail"; taskId: number }
  | { type: "accept_task"; taskId: number }
  | { type: "accept_all"; taskIds: number[] }
  | { type: "task_done"; taskId: number }
  | { type: "task_verify"; taskId: number }
  | { type: "task_block"; taskId: number }
  | { type: "task_unblock"; taskId: number }
  // Fact wizard
  | { type: "fact_select"; taskId: number }
  | { type: "fact_confirm"; taskId: number; value: number }
  | { type: "fact_cancel" }
  // Defect
  | { type: "defect_facade"; facadeId: number }
  // Legacy
  | { type: "view_tasks"; projectId: number }
  | { type: "create_tasks"; projectId: number }
  | { type: "view_modules"; projectId: number }
  | { type: "unknown"; raw: string };

function pint(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const TASK_FILTERS = new Set(["all", "assigned", "progress", "overdue", "done"]);

export function parseCallbackAction(raw: string): ParsedCallbackAction {
  if (raw === "my_tasks") return { type: "my_tasks" };
  if (raw === "enter_fact") return { type: "enter_fact" };
  if (raw === "report_defect") return { type: "report_defect" };
  if (raw === "open_app") return { type: "open_app" };
  if (raw === "summary") return { type: "summary" };
  if (raw === "setup_demo") return { type: "setup_demo" };
  if (raw === "main_menu") return { type: "main_menu" };
  if (raw === "fact_cancel") return { type: "fact_cancel" };

  if (raw.startsWith("my_tasks:")) {
    const f = raw.slice(9);
    return TASK_FILTERS.has(f) ? { type: "my_tasks_filter", filter: f as any } : { type: "my_tasks" };
  }
  if (raw.startsWith("role:")) { const a = raw.slice(5); return a ? { type: "role_action", action: a } : { type: "unknown", raw }; }

  if (raw.startsWith("task_detail:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "task_detail", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("accept:task:")) { const id = pint(raw.split(":")[2]||""); return id ? { type: "accept_task", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("task_done:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "task_done", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("task_verify:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "task_verify", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("task_block:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "task_block", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("task_unblock:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "task_unblock", taskId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("fact_select:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "fact_select", taskId: id } : { type: "unknown", raw }; }

  // fact_confirm:<taskId>:<value*100>
  if (raw.startsWith("fact_confirm:")) {
    const parts = raw.split(":");
    const taskId = pint(parts[1]||"");
    const valRaw = Number(parts[2]||"");
    if (taskId && !isNaN(valRaw)) return { type: "fact_confirm", taskId, value: valRaw / 100 };
    return { type: "unknown", raw };
  }

  if (raw.startsWith("defect_facade:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "defect_facade", facadeId: id } : { type: "unknown", raw }; }

  if (raw.startsWith("accept_all:")) {
    const ids = raw.slice(11).split(",").map(v => pint(v)).filter((v): v is number => v !== null);
    return ids.length > 0 ? { type: "accept_all", taskIds: ids } : { type: "unknown", raw };
  }

  if (raw.startsWith("view_tasks:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "view_tasks", projectId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("create_tasks:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "create_tasks", projectId: id } : { type: "unknown", raw }; }
  if (raw.startsWith("view_modules:")) { const id = pint(raw.split(":")[1]||""); return id ? { type: "view_modules", projectId: id } : { type: "unknown", raw }; }

  return { type: "unknown", raw };
}
