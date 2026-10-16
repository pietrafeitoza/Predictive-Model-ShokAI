import { Bell, ChevronDown, ChevronRight, CircleUser, LogOut, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  email: string;
  isSigningOut: boolean;
  onSignOut(): void;
  variant?: 'header' | 'sidebar';
}

function initialsFromEmail(email: string): string {
  const localPart = email.split('@')[0]?.trim() ?? '';
  const segments = localPart.split(/[._-]+/).filter(Boolean);

  if (segments.length > 1) {
    return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase() || 'U';
  }

  return localPart.slice(0, 2).toUpperCase() || 'U';
}

function AccountAvatar({ email, className }: { email: string; className?: string }) {
  return (
    <Avatar className={cn('size-8', className)}>
      <AvatarFallback className="bg-[linear-gradient(135deg,#0a82d4,#052e5c)] text-[0.6875rem] font-semibold text-white">
        {initialsFromEmail(email)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserMenu({
  email,
  isSigningOut,
  onSignOut,
  variant = 'header',
}: UserMenuProps) {
  const { isMobile, state } = useSidebar();

  if (variant === 'sidebar') {
    const isCollapsed = state === 'collapsed' && !isMobile;

    if (isCollapsed) {
      return (
        <div className="grid justify-items-center gap-1.5">
          <NavLink
            to="/dashboard/profile"
            aria-label="Open profile"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <AccountAvatar email={email} />
          </NavLink>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isSigningOut}
            aria-label={isSigningOut ? 'Signing out' : 'Sign out'}
            title={isSigningOut ? 'Signing out…' : 'Sign out'}
            onClick={onSignOut}
            className="text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut />
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
        <NavLink
          to="/dashboard/profile"
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/10"
        >
          <AccountAvatar email={email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium text-white" title={email}>
              {email}
            </p>
            <p className="truncate text-[0.6875rem] text-white/50">Demand analyst</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-white/40" aria-hidden="true" />
        </NavLink>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSigningOut}
          onClick={onSignOut}
          className="w-full justify-center border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <LogOut />
          <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${email}`}
          className="group flex h-9 items-center gap-2 rounded-full border border-border bg-white/70 pr-2 pl-1 text-left transition-colors outline-none hover:border-ocean/40 focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30"
        >
          <AccountAvatar email={email} className="size-7" />
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="flex items-center gap-3">
            <AccountAvatar email={email} />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">{email}</span>
              <span className="text-xs font-normal text-muted-foreground">
                Forecasting workspace
              </span>
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to="/dashboard/profile">
            <CircleUser />
            Profile
          </NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bell />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={() => onSignOut()}
        >
          <LogOut />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
