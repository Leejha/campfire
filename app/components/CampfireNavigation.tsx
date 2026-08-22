import type { ReactElement } from "react";
import { Flame, LayoutDashboard, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

import { Divider } from "./Divider";
import { StatusBadge } from "./StatusBadge";
import { cn } from "~/lib/utils";

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { to: "/stats", label: "우리 기록", icon: LayoutDashboard },
  { to: "/display", label: "현황판", icon: Presentation },
];

export function CampfireNavigation(): ReactElement {
  return (
    <header className="border-b border-border/80 bg-background">
      <nav
        aria-label="주요 탐색"
        className="mx-auto flex min-h-14 w-full max-w-6xl items-center px-4 sm:px-6"
      >
        <NavLink
          aria-label="Campfire 라이브 보드"
          className={({ isActive }): string =>
            cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-foreground transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive && "bg-primary text-primary-foreground",
            )
          }
          end
          to="/"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Flame aria-hidden="true" className="size-4" />
          </span>
          <span className="hidden sm:inline">Campfire</span>
          <StatusBadge tone="accent" className="hidden lg:inline-flex">
            라이브
          </StatusBadge>
        </NavLink>
        <Divider orientation="vertical" className="mx-2 hidden h-6 md:block" />
        <ul className="flex min-w-0 gap-1 overflow-x-auto py-2">
          {NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }): string =>
                    cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive && "bg-primary text-primary-foreground",
                    )
                  }
                  end={item.to === "/"}
                  to={item.to}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
