import { useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "semiconductor_sidebar_collapsed";

export function AppLayout({ children }: { children?: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "true" : "false");
    } catch {
      // ignore persistence failures
    }
  }, [sidebarCollapsed]);

  return (
    <div className="app-shell">
      <div
        className={cn(
          "grid min-h-screen w-full gap-4 px-4 py-4 md:gap-5 md:px-5 md:py-5 xl:gap-6 xl:px-6 xl:py-6",
          sidebarCollapsed
            ? "xl:grid-cols-[92px_minmax(0,1fr)]"
            : "xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]"
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => {
            setSidebarCollapsed((prev) => !prev);
          }}
        />
        <main className="min-w-0 xl:relative xl:z-0">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
