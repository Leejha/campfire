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
  { to: "/stats", label: "내 기록", icon: LayoutDashboard },
  { to: "/display", label: "현황판", icon: Presentation },
];

export function CampfireNavigation(): ReactElement {
  return (
    <header className="border-b border-stroke-neutral-subtle bg-bg-layer-default">
      <nav
        aria-label="주요 탐색"
        className="mx-auto flex min-h-[var(--seed-dimension-x14)] w-full max-w-6xl items-center px-x4 sm:px-x6"
      >
        <NavLink
          aria-label="모닥불 라이브 보드"
          className={({ isActive }): string =>
            cn(
              "inline-flex min-h-11 shrink-0 items-center gap-x2 rounded-r2 px-x2 t4-bold text-fg-neutral transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-layer-default",
              isActive && "bg-bg-brand-solid text-fg-neutral-inverted",
            )
          }
          end
          to="/"
        >
          <span className="grid size-x8 place-items-center rounded-r2 bg-bg-brand-solid text-fg-neutral-inverted">
            <Flame aria-hidden="true" className="size-x4" />
          </span>
          <span className="hidden sm:inline">모닥불</span>
          <StatusBadge tone="accent" className="hidden lg:inline-flex">
            라이브
          </StatusBadge>
        </NavLink>
        <Divider orientation="vertical" className="mx-x2 hidden h-x6 md:block" />
        <ul className="flex min-w-0 gap-x1 overflow-x-auto py-x2">
          {NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }): string =>
                    cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-x2 rounded-r2 px-x3 t4-bold text-fg-neutral-muted transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-layer-default",
                      isActive && "bg-bg-brand-solid text-fg-neutral-inverted",
                    )
                  }
                  end={item.to === "/"}
                  to={item.to}
                >
                  <Icon aria-hidden="true" className="size-x4" />
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
