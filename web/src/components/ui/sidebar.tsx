import * as React from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';

// shadcn/ui's Sidebar anatomy (SidebarHeader, SidebarGroup, SidebarMenu,
// SidebarMenuButton, SidebarMenuBadge, SidebarFooter), kept to the parts this
// portal uses. The mobile sheet and collapse-to-icons of the full shadcn
// component are not here: below 1024px the portal has its own bottom bar.

function Sidebar({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav data-slot="sidebar" className={cn('sb', className)} {...props} />;
}
function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" className={cn('sb-header', className)} {...props} />;
}
function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-content" className={cn('sb-content', className)} {...props} />;
}
function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" className={cn('sb-footer', className)} {...props} />;
}
function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-group" className={cn('sb-group', className)} {...props} />;
}
function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="sidebar-group-label" className={cn('sb-group-label', className)} {...props} />;
}
function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" className={cn('sb-menu', className)} {...props} />;
}
function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('sb-item', className)} {...props} />;
}
type ButtonProps = { to: string; icon?: React.ReactNode; badge?: React.ReactNode; end?: boolean;
  testId?: string; children: React.ReactNode; onClick?: () => void; muted?: boolean };
/** A menu link. NavLink sets aria-current="page" on the current one. */
function SidebarMenuButton({ to, icon, badge, end, testId, children, onClick, muted }: ButtonProps) {
  return (
    <NavLink to={to} end={end} data-testid={testId} onClick={onClick}
             className={cn('sb-button', muted && 'sb-button--muted')}>
      {icon && <span className="sb-icon" aria-hidden="true">{icon}</span>}
      <span className="sb-label">{children}</span>
      {badge != null && <span className="sb-badge">{badge}</span>}
    </NavLink>
  );
}

export {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
};
