import { type PropsWithChildren, useEffect, useRef } from 'react';
import { PanelLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandPalette } from '../dashboard/CommandPalette';
import { DashboardStateProvider } from '../dashboard/dashboard-state';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavigation } from './DashboardNavigation';
import { ThemeProvider } from './ThemeProvider';

interface DashboardLayoutProps extends PropsWithChildren {
  email: string;
  isSigningOut: boolean;
  locationLabel?:
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
  onSignOut(): void;
  signOutError: string | null;
}

function DashboardShell({
  children,
  email,
  isSigningOut,
  locationLabel = 'Dashboard',
  onSignOut,
  signOutError,
}: DashboardLayoutProps) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isMobile && wasOpen.current && !openMobile) {
      triggerRef.current?.focus();
    }
    wasOpen.current = openMobile;
  }, [isMobile, openMobile]);

  return (
    <>
      <DashboardNavigation
        email={email}
        isSigningOut={isSigningOut}
        onSignOut={onSignOut}
      />

      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <a
          href="#dashboard-main"
          className="fixed top-2 left-2 z-[100] -translate-y-40 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>

        <DashboardHeader
          email={email}
          isSigningOut={isSigningOut}
          locationLabel={locationLabel}
          menuTrigger={
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open navigation"
              onClick={() => {
                if (isMobile) setOpenMobile(true);
              }}
              className="md:hidden"
            >
              <PanelLeft />
            </Button>
          }
          onSignOut={onSignOut}
        />

        {signOutError ? (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-[0.8125rem] text-danger lg:mx-8"
          >
            {signOutError}
          </div>
        ) : null}

        <main
          id="dashboard-main"
          tabIndex={-1}
          className="min-w-0 flex-1 bg-[radial-gradient(1100px_520px_at_100%_-8%,#eaf4fc,transparent),radial-gradient(900px_500px_at_-5%_110%,#eef7f1,transparent)] px-5 py-6 outline-none lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>

      <CommandPalette />
    </>
  );
}

function initialSidebarOpen(): boolean {
  if (typeof document === 'undefined') return true;

  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/);
  return match ? match[1] === 'true' : true;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider defaultOpen={initialSidebarOpen()}>
          <DashboardStateProvider>
            <DashboardShell {...props} />
          </DashboardStateProvider>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
