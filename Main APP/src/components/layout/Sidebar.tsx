import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Share2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const patientNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'My Records', href: '/records', icon: <FileText size={20} /> },
  { label: 'Shared Access', href: '/shared', icon: <Share2 size={20} /> },
];

const doctorNavItems: NavItem[] = [
  { label: 'Scan Record', href: '/doctor', icon: <Stethoscope size={20} /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Help & Support', href: '/help', icon: <HelpCircle size={20} /> },
];

interface SidebarProps {
  userType?: 'patient' | 'doctor';
}

export function Sidebar({ userType = 'patient' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const navItems = userType === 'patient' ? patientNavItems : doctorNavItems;

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl">
                  <img src="/favicon.png" alt="Logo" className="h-6 w-6 rounded-md object-cover" />
                </div>
                <span className="text-xl font-bold text-slate-900">Salud Healths</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {collapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl mx-auto">
              <img src="/favicon.png" alt="Logo" className="h-6 w-6 rounded-md object-cover" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          <div className="mb-2">
            {!collapsed && (
              <span className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Menu
              </span>
            )}
          </div>
          
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname === item.href}
            />
          ))}

          {/* Doctor Link (for patient view) */}
          {userType === 'patient' && (
            <>
              <div className="my-4 border-t border-slate-200" />
              {!collapsed && (
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Provider
                </span>
              )}
              <NavItem
                item={doctorNavItems[0]}
                collapsed={collapsed}
                isActive={location.pathname === doctorNavItems[0].href}
              />
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-slate-200 p-3">
          {bottomNavItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname === item.href}
            />
          ))}

          {/* Logout Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
                  collapsed && 'justify-center px-2'
                )}
              >
                <LogOut size={20} />
                {!collapsed && <span>Disconnect</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <p>Disconnect</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-50 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </Button>
      </motion.aside>
    </TooltipProvider>
  );
}

interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}

function NavItem({ item, collapsed, isActive }: NavItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-2',
            isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <span className={cn(isActive && 'text-primary-600')}>{item.icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-medium text-white">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right">
          <p>{item.label}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
