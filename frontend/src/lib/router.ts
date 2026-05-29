import { derived, writable } from "svelte/store";
import { appRoutes } from "./mock-data";

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname || "/";
}

const initialPath =
  typeof window === "undefined" ? "/" : normalizePath(window.location.pathname);

export const currentPath = writable(initialPath);

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    currentPath.set(normalizePath(window.location.pathname));
  });
}

export const currentRoute = derived(currentPath, ($currentPath) =>
  appRoutes.find((route) => route.path === $currentPath) ?? appRoutes[0],
);

export function navigate(path: string) {
  const nextPath = normalizePath(path);
  if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
    window.history.pushState({}, "", nextPath);
  }
  currentPath.set(nextPath);
}
