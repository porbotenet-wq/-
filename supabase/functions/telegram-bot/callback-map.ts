export type ParsedCallbackAction =
  | { type: "my_tasks" }
  | { type: "enter_fact" }
  | { type: "report_defect" }
  | { type: "open_app" }
  | { type: "summary" }
  | { type: "setup_demo" }
  | { type: "fact_select"; taskId: number }
  | { type: "defect_facade"; facadeId: number }
  | { type: "accept_task"; taskId: number }
  | { type: "accept_all"; taskIds: number[] }
  | { type: "view_tasks"; projectId: number }
  | { type: "create_tasks"; projectId: number }
  | { type: "view_modules"; projectId: number }
  | { type: "unknown"; raw: string };

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseCallbackAction(rawData: string): ParsedCallbackAction {
  if (rawData === "my_tasks") return { type: "my_tasks" };
  if (rawData === "enter_fact") return { type: "enter_fact" };
  if (rawData === "report_defect") return { type: "report_defect" };
  if (rawData === "open_app") return { type: "open_app" };
  if (rawData === "summary") return { type: "summary" };
  if (rawData === "setup_demo") return { type: "setup_demo" };

  if (rawData.startsWith("fact_select:")) {
    const taskId = parsePositiveInt(rawData.split(":")[1] || "");
    return taskId ? { type: "fact_select", taskId } : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("defect_facade:")) {
    const facadeId = parsePositiveInt(rawData.split(":")[1] || "");
    return facadeId
      ? { type: "defect_facade", facadeId }
      : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("accept:task:")) {
    const taskId = parsePositiveInt(rawData.split(":")[2] || "");
    return taskId ? { type: "accept_task", taskId } : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("accept_all:")) {
    const rawIds = rawData.replace("accept_all:", "").split(",");
    const taskIds = rawIds
      .map((value) => parsePositiveInt(value))
      .filter((value): value is number => value !== null);
    return taskIds.length > 0
      ? { type: "accept_all", taskIds }
      : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("view_tasks:")) {
    const projectId = parsePositiveInt(rawData.split(":")[1] || "");
    return projectId
      ? { type: "view_tasks", projectId }
      : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("create_tasks:")) {
    const projectId = parsePositiveInt(rawData.split(":")[1] || "");
    return projectId
      ? { type: "create_tasks", projectId }
      : { type: "unknown", raw: rawData };
  }

  if (rawData.startsWith("view_modules:")) {
    const projectId = parsePositiveInt(rawData.split(":")[1] || "");
    return projectId
      ? { type: "view_modules", projectId }
      : { type: "unknown", raw: rawData };
  }

  return { type: "unknown", raw: rawData };
}
