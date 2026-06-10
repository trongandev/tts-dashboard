import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, DollarSign, LogOut, Info, Puzzle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useUser();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Tổng quan', path: '/' },
    { icon: <Calendar size={20} />, label: 'Lịch dạy', path: '/timesheet' },
    { icon: <DollarSign size={20} />, label: 'Công lương', path: '/salary' },
    { icon: <Puzzle size={20} />, label: 'Tiện ích', path: '/extension' },
    { icon: <Info size={20} />, label: 'Về chúng tôi', path: '/about' },
  ];

  const getInitials = (name?: string) => {
    if (!name || name === 'Người dùng') return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = user?.displayName || user?.username || 'Người dùng';
  const email = user?.email || '';


  return (
    <>
      <aside className="hidden md:flex w-64 bg-burgundy flex-col shrink-0 min-h-screen z-50">
        <div className="p-8">
          <h1 className="text-white text-3xl font-bold tracking-tight">
            TSS<span className="text-sm font-light opacity-70 align-top ml-1">Portal</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all font-medium ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-white/10 flex flex-col gap-2">
          <div className="flex items-center space-x-3 p-2 text-left w-full rounded-lg">
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white/20 flex items-center justify-center font-bold text-burgundy shrink-0">
              {getInitials(displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-white/50 truncate">{email || 'Giáo viên'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setUser(null);
              document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              document.cookie = 'idToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              navigate('/login');
            }}
            className="flex items-center justify-center space-x-2 p-2 w-full text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors text-sm font-medium mt-2 cursor-pointer"
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center z-50 h-16 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-burgundy' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {React.cloneElement(item.icon as React.ReactElement, { size: 20 })}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
