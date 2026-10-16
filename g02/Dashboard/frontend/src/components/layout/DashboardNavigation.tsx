import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  Boxes,
  BrainCircuit,
  Camera,
  Check,
  ChevronsUpDown,
  Database,
  FolderInput,
  History,
  LayoutDashboard,
  LineChart,
  Network,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';

interface DashboardNavigationProps {
  email?: string;
  isSigningOut?: boolean;
  onSignOut?: () => void;
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  initial: string;
  accent: string;
}

interface NavChild {
  label: string;
  badge?: string;
  icon: LucideIcon;
  to?: string;
}

interface PlatformNavItem {
  label: string;
  icon: LucideIcon;
  count?: number;
  to?: string;
  children?: NavChild[];
}

const workspaces: Workspace[] = [
  {
    id: 'oncology',
    name: 'Oncology BU',
    plan: 'Team',
    initial: 'ON',
    accent: 'bg-[linear-gradient(135deg,#00a5df,#0069b4)]',
  },
  {
    id: 'latam',
    name: 'LATAM Region',
    plan: 'Team',
    initial: 'LA',
    accent: 'bg-[linear-gradient(135deg,#2fa84f,#1b6c32)]',
  },
];

const platformNav: PlatformNavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  {
    label: 'Models',
    icon: BrainCircuit,
    children: [
      { label: 'Registry', icon: Boxes, to: '/dashboard/models/registry' },
      { label: 'Explainability', icon: Sparkles, to: '/dashboard/models' },
    ],
  },
  {
    label: 'Forecasts',
    icon: LineChart,
    children: [
      { label: 'Overview', icon: Activity, to: '/dashboard/forecasts' },
      { label: 'Backtests', icon: History, to: '/dashboard/forecasts/backtests' },
      { label: 'Scenarios', icon: SlidersHorizontal, to: '/dashboard/forecasts/scenarios' },
    ],
  },
  {
    label: 'Datasets',
    icon: Database,
    children: [
      { label: 'Sources', icon: FolderInput, to: '/dashboard/datasets' },
      { label: 'Snapshots', icon: Camera, to: '/dashboard/datasets/snapshots' },
      { label: 'Lineage', icon: Network, to: '/dashboard/datasets/lineage' },
    ],
  },
];

function countBadgeClassName() {
  return 'ml-auto border-transparent bg-white/10 font-mono text-[0.6875rem] font-medium text-white/70 group-hover/menu-button:bg-white/15 group-hover/menu-button:text-white group-data-[collapsible=icon]:hidden';
}

const navItemClassName =
  'h-12 text-base font-medium transition-[width,height,padding,background-color,color,box-shadow] duration-200 ease-out [&_svg]:size-5 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out group-hover/menu-button:[&_svg]:scale-110';

function subMenuItemClassName(isActive: boolean) {
  return cn(
    'h-10 gap-2.5 rounded-lg px-3 text-[0.875rem] font-normal text-sidebar-foreground/70 transition-[width,height,padding,background-color,color] duration-200 ease-out [&>svg]:text-current [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out group-hover/menu-sub-item:[&_svg]:scale-110',
    'hover:bg-white/5 hover:text-white',
    isActive && 'font-medium',
  );
}

export function DashboardNavigation({
  email,
  isSigningOut = false,
  onSignOut,
}: DashboardNavigationProps) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentWorkspace = workspaces[0];

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="gap-2 border-b border-white/10 p-3 group-data-[collapsible=icon]:p-2">
        <div
          className={cn(
            'flex items-center justify-between gap-2',
            isMobile && 'flex-row-reverse',
            'group-data-[collapsible=icon]:justify-center',
          )}
        >
          <NavLink
            to="/dashboard"
            end
            aria-label="ShokAI Dashboard"
            className="flex min-w-0 items-center px-1 group-data-[collapsible=icon]:px-0"
          >
            <img
              src="/assets/shokai-full-black.svg"
              alt="ShokAI"
              className="h-6 w-auto brightness-0 invert group-data-[collapsible=icon]:hidden"
            />
            <img
              src="/assets/shokai-icon-black.svg"
              alt="ShokAI"
              className="hidden h-6 w-auto brightness-0 invert group-data-[collapsible=icon]:block"
            />
          </NavLink>
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              onClick={() => setOpenMobile(false)}
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            >
              <X />
            </Button>
          ) : null}
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Switch workspace, current ${currentWorkspace.name}`}
                className="flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
              >
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  <AvatarFallback
                    className={cn(
                      'rounded-lg text-[0.6875rem] font-semibold text-white',
                      currentWorkspace.accent,
                    )}
                  >
                    {currentWorkspace.initial}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-[0.8125rem] font-semibold text-white">
                    {currentWorkspace.name}
                  </span>
                  <span className="truncate text-[0.6875rem] text-white/50">
                    {currentWorkspace.plan} workspace
                  </span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-white/40 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="w-64">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((workspace) => {
                const isCurrent = workspace.id === currentWorkspace.id;

                return (
                  <DropdownMenuItem key={workspace.id} className="gap-2.5">
                    <Avatar className="size-7 rounded-md after:rounded-md">
                      <AvatarFallback
                        className={cn(
                          'rounded-md text-[0.625rem] font-semibold text-white',
                          workspace.accent,
                        )}
                      >
                        {workspace.initial}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-sm text-foreground">{workspace.name}</span>
                      <span className="text-xs text-muted-foreground">{workspace.plan}</span>
                    </span>
                    {isCurrent ? <Check className="ml-auto" /> : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5">
                <span className="grid size-7 place-items-center rounded-md border border-dashed border-border text-muted-foreground">
                  <Plus className="size-3.5" />
                </span>
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Primary navigation" className="flex flex-col">
          <SidebarGroup className="gap-1.5">
            <SidebarGroupLabel className="h-10 px-3 text-sm font-medium text-sidebar-foreground/50">
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {platformNav.map((item) => {
                  const Icon = item.icon;

                  if (item.to) {
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.to}
                          tooltip={item.label}
                          className={navItemClassName}
                        >
                          <NavLink to={item.to} end aria-label={item.label}>
                            <Icon />
                            <span>{item.label}</span>
                            {typeof item.count === 'number' ? (
                              <Badge className={countBadgeClassName()}>{item.count}</Badge>
                            ) : null}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        className={navItemClassName}
                      >
                        <Icon />
                        <span>{item.label}</span>
                        {typeof item.count === 'number' ? (
                          <Badge className={countBadgeClassName()}>{item.count}</Badge>
                        ) : null}
                      </SidebarMenuButton>
                      <SidebarMenuSub className="gap-1.5 border-l-0 py-1.5">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const isActive = child.to !== undefined && pathname === child.to;

                          if (!child.to) {
                            return (
                              <SidebarMenuSubItem key={child.label}>
                                <SidebarMenuSubButton asChild className={subMenuItemClassName(false)}>
                                  <button type="button" className="w-full text-left">
                                    <ChildIcon aria-hidden="true" />
                                    <span className="truncate">{child.label}</span>
                                    {child.badge ? (
                                      <Badge className="ml-auto border-transparent bg-white/10 text-[0.625rem] font-medium text-white/70 group-hover/menu-sub-item:bg-white/15 group-hover/menu-sub-item:text-white">
                                        {child.badge}
                                      </Badge>
                                    ) : null}
                                  </button>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          }

                          return (
                            <SidebarMenuSubItem key={child.label}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive}
                                className={subMenuItemClassName(isActive)}
                              >
                                <NavLink to={child.to} end>
                                  <ChildIcon aria-hidden="true" />
                                  <span className="truncate">{child.label}</span>
                                  {child.badge ? (
                                    <Badge className="ml-auto border-transparent bg-white/10 text-[0.625rem] font-medium text-white/70 group-hover/menu-sub-item:bg-white/15 group-hover/menu-sub-item:text-white">
                                      {child.badge}
                                    </Badge>
                                  ) : null}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        {email && onSignOut ? (
          <UserMenu
            email={email}
            isSigningOut={isSigningOut}
            onSignOut={onSignOut}
            variant="sidebar"
          />
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
