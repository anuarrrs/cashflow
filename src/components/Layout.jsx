import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Settings, LogOut } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function Layout() {
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/settings', icon: Settings, label: 'Настройки' }
  ]

  return (
    <div className="min-h-screen bg-[#121212] text-white flex justify-center font-sans">
      <div className="w-full max-w-md bg-[#121212] h-[100dvh] relative flex flex-col sm:border-x sm:border-[#2A2A2A] overflow-hidden">
        
        <main className="flex-1 overflow-y-auto p-4 pb-24 safe-top safe-bottom">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-0 w-full sm:absolute sm:bottom-0 bg-[#1E1E1E]/90 backdrop-blur-md border-t border-[#2A2A2A] pb-safe">
          <div className="max-w-md mx-auto flex justify-around items-center p-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                    isActive ? 'text-[#6366F1]' : 'text-gray-500 hover:text-gray-300 active:scale-95'
                  }`}
                >
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] mt-1 font-medium tracking-wide">{item.label}</span>
                </Link>
              )
            })}
            
            <button 
              onClick={handleLogout}
              className="flex flex-col items-center p-2 text-red-500/70 hover:text-red-500 transition-colors rounded-xl cursor-pointer active:scale-95"
            >
              <LogOut size={24} strokeWidth={2} />
              <span className="text-[10px] mt-1 font-medium tracking-wide">Выйти</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}