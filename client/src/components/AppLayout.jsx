import { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  Menu,
  Receipt,
  Refrigerator,
  Salad,
  ShoppingCart,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationWatcher } from './NotificationWatcher';
import { OfflineBanner } from './OfflineBanner';

const navItems = [
  { label: '대시보드', path: '/', icon: LayoutDashboard },
  { label: '구매내역', path: '/purchases', icon: Receipt },
  { label: '식재료', path: '/ingredients', icon: Refrigerator },
  { label: '메뉴·레시피', path: '/recipes', icon: ChefHat },
  { label: '식단 일기', path: '/meal-diary', icon: CalendarDays },
  { label: '영양정보', path: '/nutrition', icon: Salad },
  { label: '알림 설정', path: '/settings/notifications', icon: Bell },
  { label: '통계', path: '/statistics', icon: BarChart3 },
  { label: '장보기 리스트', path: '/shopping-list', icon: ShoppingCart },
  { label: '레시피 추천', path: '/recommendations', icon: Sparkles }
];

function SidebarContent() {
  return (
    <div className="flex h-full flex-col rounded-[32px] border border-border bg-white px-5 py-6 shadow-card">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage">
          <Refrigerator size={22} />
        </div>
        <div>
          <div className="text-lg font-extrabold text-slate-900">FreshTable</div>
          <div className="text-xs text-slate-400">ingredient & meal journal</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'pill-nav justify-between px-4 py-3 text-slate-500 hover:bg-[#F7FAF5] hover:text-slate-900',
                  isActive && 'bg-[#EDF7E7] text-slate-900 shadow-sm'
                )
              }
            >
              {({ isActive }) => (
                <span className="flex items-center gap-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', isActive ? 'bg-sage text-white' : 'bg-slate-50 text-slate-500')}>
                    <Icon size={18} />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="rounded-3xl bg-[#F4F8F1] p-4 text-sm text-slate-600">
        <div className="font-semibold text-slate-900">FreshTable</div>
        <p className="mt-1 leading-6">구매, 식재료, 식단 기록을 한곳에서 관리해요.</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }), []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-3 md:p-5">
      <NotificationWatcher />
      <div className="mx-auto flex max-w-[1600px] gap-5">
        <aside className="hidden w-[240px] shrink-0 lg:block">
          <SidebarContent />
        </aside>

        <div className="flex min-h-[calc(100vh-24px)] flex-1 flex-col gap-5">
          <div className="flex items-center justify-between rounded-[28px] border border-border bg-white/90 px-4 py-3 shadow-card lg:hidden">
            <button type="button" onClick={() => setOpen((prev) => !prev)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white">
              <Menu size={20} />
            </button>
            <div className="text-center">
              <div className="font-bold">FreshTable</div>
              <div className="text-xs text-slate-400">{today}</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-[#EDF7E7]" />
          </div>

          {open && (
            <div className="lg:hidden">
              <SidebarContent />
            </div>
          )}

          <main className="flex-1">
            <OfflineBanner />
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
