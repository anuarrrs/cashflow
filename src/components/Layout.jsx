import { Outlet, NavLink } from 'react-router-dom'
import { Home, Settings, PieChart } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white font-sans max-w-md mx-auto sm:border-x sm:border-[#2A2A2A] shadow-2xl relative">
      <main className="flex-1 overflow-y-auto px-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-[#18181B]/90 backdrop-blur-md border-t border-[#2A2A2A] px-6 py-3 pb-safe z-40">
        <div className="flex justify-between items-center">
          <NavLink 
            to="/" 
            className={({isActive}) => `flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-[#6366F1]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Home size={24} />
            <span className="text-[10px] font-medium">Главная</span>
          </NavLink>
          
          <NavLink 
            to="/stats" 
            className={({isActive}) => `flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-[#6366F1]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <PieChart size={24} />
            <span className="text-[10px] font-medium">Аналитика</span>
          </NavLink>

          <NavLink 
            to="/settings" 
            className={({isActive}) => `flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-[#6366F1]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Settings size={24} />
            <span className="text-[10px] font-medium">Настройки</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}