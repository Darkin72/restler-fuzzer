import type { AppRoute } from "./types";

export const appRoutes: AppRoute[] = [
  { path: "/", label: "Start", description: "Prepare the Bio workspace and generate the full fuzz command" },
  { path: "/results", label: "Results", description: "Read output artifacts and analysis entry points" },
];
