import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronRight, Plus, Calendar, RotateCcw } from 'lucide-react'
import AddExpenseModal from '../components/AddExpenseModal'

const homeState = {
  date: new Date(),
  isAllTime: false
}
const homeCache = { categories: null }

export default function Home() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [currentDate, setCurrentDate] = useState(homeState.date)
  const [isAllTime, setIsAllTime] = useState(homeState.isAllTime)
  
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    if (homeCache.categories) {
      setCategories(homeCache.categories)
      setLoading(false)
    } else {
      setLoading(true)
    }
    
    const { data } = await supabase.from('categories').select('*').order('created_at', { ascending: true })
    if (data) {
      homeCache.categories = data
      setCategories(data)
    }
    setLoading(false)
  }

  const updateDate = (newDate, allTime) => {
    setCurrentDate(newDate)
    setIsAllTime(allTime)
    homeState.date = newDate
    homeState.isAllTime = allTime
  }

  const handlePrevMonth = () => updateDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1), false)
  const handleNextMonth = () => updateDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1), false)
  const handleCurrentMonth = () => updateDate(new Date(), false)

  const monthName = currentDate.toLocaleString('ru-RU', { month: 'long' })
  const year = currentDate.getFullYear()

  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-col items-center pb-2 safe-top">
        <div className="flex items-center justify-between w-full max-w-xs mb-4">
          <button onClick={handlePrevMonth} className="p-2 text-gray-500 hover:text-white transition-colors active:scale-95">
            <ChevronLeft size={32} />
          </button>
          
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold tracking-tight capitalize">
              {isAllTime ? 'За всё время' : monthName}
            </h1>
            {!isAllTime && <p className="text-[#6366F1] font-medium tracking-wide text-sm mt-1">{year}</p>}
          </div>

          <button onClick={handleNextMonth} className="p-2 text-gray-500 hover:text-white transition-colors active:scale-95">
            <ChevronRight size={32} />
          </button>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleCurrentMonth}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1E1E1E] border border-[#2A2A2A] text-gray-400 hover:text-white rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw size={14} /> Текущий
          </button>

          <button 
            onClick={() => updateDate(currentDate, !isAllTime)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 cursor-pointer ${
              isAllTime ? 'bg-[#6366F1] text-white' : 'bg-[#1E1E1E] border border-[#2A2A2A] text-gray-400 hover:text-white'
            }`}
          >
            <Calendar size={14} /> {isAllTime ? 'К месяцу' : 'За всё время'}
          </button>
        </div>
      </header>
      
      {loading ? (
        <div className="text-center text-gray-500 py-8 animate-pulse">Загрузка категорий...</div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="flex items-center justify-between bg-[#1E1E1E] border border-[#2A2A2A] p-4 rounded-2xl hover:bg-[#2A2A2A]/40 transition-colors cursor-pointer active:scale-[0.98]"
              onClick={() => {
                const m = currentDate.getMonth()
                const y = currentDate.getFullYear()
                navigate(`/category/${category.id}?month=${m}&year=${y}&allTime=${isAllTime}`)
              }}
            >
              <span className="font-medium text-lg">{category.name}</span>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation() 
                  setSelectedCategory(category) 
                }}
                className="bg-[#2A2A2A] hover:bg-[#6366F1] text-gray-300 hover:text-white p-2.5 rounded-xl transition-colors cursor-pointer active:scale-90"
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <AddExpenseModal 
        category={selectedCategory} 
        onClose={() => setSelectedCategory(null)} 
      />
    </div>
  )
}