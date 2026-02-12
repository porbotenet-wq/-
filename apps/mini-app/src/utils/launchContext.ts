type MiniAppScreen = "dashboard" | "tasks" | "plan-fact" | "modules" | "project";

type LaunchContext = {
  screen?: MiniAppScreen;
  taskId?: number;
  facadeId?: number;
  date?: string;
  mode?: string;
};

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function isIsoDate(value: string | null): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeScreen(value: string | null): MiniAppScreen | undefined {
  if (!value) return undefined;
  if (value === "dashboard") return "dashboard";
  if (value === "tasks") return "tasks";
  if (value === "modules") return "modules";
  if (value === "project") return "project";
  if (value === "plan-fact" || value === "plan_fact") return "plan-fact";
  return undefined;
}

function parseStartParam(startParam?: string | null): LaunchContext {
  if (!startParam) return {};

  const taskMatch = startParam.match(/^task_(\d+)$/);
  if (taskMatch) {
    return {
      screen: "tasks",
      taskId: Number(taskMatch[1]),
    };
  }

  const planFactMatch = startParam.match(/^plan_fact_(\d{4}-\d{2}-\d{2})$/);
  if (planFactMatch) {
    return {
      screen: "plan-fact",
      date: planFactMatch[1],
    };
  }

  const defectMatch = startParam.match(/^defect_facade_(\d+)$/);
  if (defectMatch) {
    return {
      screen: "tasks",
      facadeId: Number(defectMatch[1]),
      mode: "defect",
    };
  }

  if (startParam === "tasks") return { screen: "tasks" };
  if (startParam === "plan_fact") return { screen: "plan-fact" };
  if (startParam === "modules") return { screen: "modules" };
  if (startParam === "project") return { screen: "project" };

  return { screen: "dashboard" };
}

export function resolveLaunchRoute(startParam?: string | null, search = ""): string | null {
  const searchParams = new URLSearchParams(search);
  const queryStartParam = searchParams.get("startapp");

  const fromStart = parseStartParam(queryStartParam || startParam);
  const fromQuery: LaunchContext = {
    screen: normalizeScreen(searchParams.get("screen")),
    taskId: parsePositiveInt(searchParams.get("task_id") || searchParams.get("taskId")),
    facadeId: parsePositiveInt(searchParams.get("facade_id") || searchParams.get("facadeId")),
    date: isIsoDate(searchParams.get("date")) ? searchParams.get("date") || undefined : undefined,
    mode: searchParams.get("mode") || undefined,
  };

  const context: LaunchContext = {
    ...fromStart,
    ...fromQuery,
  };

  if (!context.screen && !context.taskId && !context.facadeId && !context.date) {
    return null;
  }

  const screen = context.screen || (context.date ? "plan-fact" : "tasks");
  const path =
    screen === "dashboard"
      ? "/"
      : screen === "tasks"
        ? "/tasks"
        : screen === "plan-fact"
          ? "/plan-fact"
          : screen === "modules"
            ? "/modules"
            : "/project";

  const routeParams = new URLSearchParams();
  if (context.taskId) routeParams.set("task_id", String(context.taskId));
  if (context.facadeId) routeParams.set("facade_id", String(context.facadeId));
  if (context.date) routeParams.set("date", context.date);
  if (context.mode) routeParams.set("mode", context.mode);

  const query = routeParams.toString();
  return query ? `${path}?${query}` : path;
}

export function parsePositiveIntParam(value: string | null): number | null {
  return parsePositiveInt(value) ?? null;
}

export function parseIsoDateParam(value: string | null): string | null {
  return isIsoDate(value) ? value : null;
}
