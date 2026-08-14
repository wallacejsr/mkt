import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Target, 
  CalendarDays, 
  Megaphone, 
  Users, 
  Building2,
  Lightbulb, 
  BarChart, 
  MessageSquare,
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Estratégia', path: '/strategy', icon: Target },
  { name: 'Conteúdo', path: '/content', icon: CalendarDays },
  { name: 'Campanhas', path: '/campaigns', icon: Megaphone },
  { name: 'Leads', path: '/leads', icon: Users },
  { name: 'Prospecção', path: '/prospecting', icon: Building2 },
  { name: 'Oportunidades', path: '/opportunities', icon: Lightbulb },
  { name: 'Analytics', path: '/analytics', icon: BarChart },
  { name: 'Assistente', path: '/assistant', icon: MessageSquare },
];

export function Layout() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex-1 flex flex-col min-h-0 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center gap-3 px-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">M</div>
            <span className="font-bold text-lg tracking-tight">Marketing OS</span>
          </div>
          <nav className="mt-8 flex-1 px-4 space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Menu Principal</div>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon
                    className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                      isActive ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 p-2 w-full hover:bg-slate-50 rounded-lg cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold truncate">
                  {user?.displayName || 'Usuário'}
                </p>
                <p className="text-xs text-slate-500 truncate">Sua Empresa</p>
              </div>
              <button onClick={signOut} className="text-slate-400 hover:text-slate-600" title="Sair">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:pl-64 flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
