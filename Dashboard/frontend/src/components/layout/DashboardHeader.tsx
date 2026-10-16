import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { OPEN_COMMAND_PALETTE_EVENT } from '../dashboard/CommandPalette';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface DashboardHeaderProps {
  email: string;
  isSigningOut: boolean;
  locationLabel:
    | 'Dashboard'
    | 'Models'
    | 'Model registry'
    | 'Forecasts'
    | 'Backtests'
    | 'Scenarios'
    | 'Datasets'
    | 'Snapshots'
    | 'Lineage'
    | 'Profile';
  menuTrigger: ReactNode;
  onSignOut(): void;
}

const locationBreadcrumbs: Record<DashboardHeaderProps['locationLabel'], string> = {
  Dashboard: 'Demand intelligence',
  Models: 'Model explainability',
  'Model registry': 'Model registry',
  Forecasts: 'Forecast overview',
  Backtests: 'Backtests',
  Scenarios: 'Scenarios',
  Datasets: 'Dataset sources',
  Snapshots: 'Snapshots',
  Lineage: 'Lineage',
  Profile: 'Your account',
};

export function DashboardHeader({
  email,
  isSigningOut,
  locationLabel,
  menuTrigger,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-17 items-center justify-between gap-6 border-b border-border/70 bg-white/75 px-5 backdrop-blur-xl lg:px-8 dark:bg-card/60">
      <div className="flex min-w-0 items-center gap-3">
        {menuTrigger}
        <SidebarTrigger
          aria-label="Toggle navigation"
          className="hidden text-grey-600 md:inline-flex dark:text-grey-400"
        />
        <img
          src="/assets/shokai-full-black.svg"
          alt="ShokAI"
          className="h-5 w-auto md:hidden"
        />
        <Breadcrumb className="hidden min-w-0 md:block">
          <BreadcrumbList>
            <BreadcrumbItem className="max-[900px]:hidden">
              <BreadcrumbLink asChild>
                <NavLink to="/dashboard" end>
                  Workspace
                </NavLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="max-[900px]:hidden" />
            <BreadcrumbItem>
              <Badge className="rounded-full border border-ocean-100 bg-ocean-50 px-2.5 py-1 text-xs font-medium text-ocean-700 dark:border-white/10 dark:bg-white/10 dark:text-ocean-100">
                Dashboard preview
              </Badge>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="max-[560px]:hidden" />
            <BreadcrumbItem className="max-[560px]:hidden">
              <BreadcrumbPage>{locationBreadcrumbs[locationLabel]}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Open command palette"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          className="hidden h-9 items-center gap-2 rounded-full border border-border bg-white/70 px-3 text-[0.8125rem] text-grey-600 transition-colors hover:border-ocean/40 hover:text-navy sm:inline-flex dark:bg-input/30 dark:hover:text-white"
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span className="max-[900px]:hidden">Search actions</span>
          <kbd className="rounded border border-border bg-grey-50 px-1.5 py-0.5 font-mono text-[0.625rem] text-grey-400 dark:bg-white/10">
            ⌘K
          </kbd>
        </button>
        <ThemeToggle />
        <UserMenu email={email} isSigningOut={isSigningOut} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
