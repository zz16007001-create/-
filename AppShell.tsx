import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  PackagePlus,
  Receipt,
  Users,
  ArrowLeftRight,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Store,
  Menu,
  X,
  Camera,
  Download,
} from 'lucide-react';
import { SyncIndicator } from './SyncIndicator';
import { signOut, subscribeToAuth } from '../../lib/auth';
import { migrateWalletKeys } from '../../lib/data';

const NAV_ITEMS = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/cashier', label: 'الكاشير', icon: ShoppingCart },
  { to: '/items', label: 'المخزون', icon: Boxes },
  { to: '/purchase', label: 'إضافة بضاعة', icon: PackagePlus },
  { to: '/invoices', label: 'الفواتير', icon: Receipt },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/transactions', label: 'العمليات', icon: ArrowLeftRight },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/snapshot', label: 'الجرد والإغلاق', icon: Camera },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
  { to: '/backup', label: 'النسخ الاحتياطي', icon: Download },
];

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // حارس الدخول: undefined = جارٍ الفحص، null = غير مسجل
  const [authUser, setAuthUser] = useState<any | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setAuthUser(user);
      if (!user) {
        navigate('/login', { replace: true });
      } else {
        // ترحيل لمرة واحدة لأرصدة الخزائن القديمة (آمن للتكرار)
        migrateWalletKeys().catch((e) => console.warn('migrateWalletKeys:', e));
      }
    });
    return unsub;
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Ignore signOut errors
    } finally {
      navigate('/login');
    }
  };

  if (authUser === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">جاري التحقق من تسجيل الدخول...</div>;
  }
  if (authUser === null) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col antialiased text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 lg:px-6 h-16 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#14b8a6] text-white flex items-center justify-center shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base lg:text-lg text-slate-900 leading-tight">
              محلي
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              نظام إدارة المبيعات والمخزون
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SyncIndicator />

          <button
            onClick={handleSignOut}
            title="تسجيل الخروج"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-slate-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-60 bg-white border-l border-slate-200/80 p-3 shrink-0">
          <nav className="space-y-1 overflow-y-auto flex-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#14b8a6] text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Overlay for "المزيد" */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute bottom-16 inset-x-0 bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-800 text-sm">كافة أقسام النظام</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 p-3 rounded-xl text-xs font-medium border ${
                        isActive
                          ? 'border-[#14b8a6] bg-[#14b8a6]/10 text-[#0d9488]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 text-[#14b8a6]" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 md:hidden flex items-center justify-around h-16 px-2 shadow-lg">
        <NavLink
          to="/cashier"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 py-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-[#14b8a6]' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span>الكاشير</span>
        </NavLink>

        <NavLink
          to="/items"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 py-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-[#14b8a6]' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          <span>المخزون</span>
        </NavLink>

        <NavLink
          to="/purchase"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 py-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-[#14b8a6]' : 'text-slate-500 hover:text-slate-900'
            }`
          }
        >
          <PackagePlus className="w-5 h-5 mb-0.5" />
          <span>إضافة بضاعة</span>
        </NavLink>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-16 py-1 text-[11px] font-medium transition-colors ${
            mobileMenuOpen ? 'text-[#14b8a6]' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>المزيد</span>
        </button>
      </nav>
    </div>
  );
};
