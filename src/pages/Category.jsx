import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Store } from 'lucide-react'
import ExpenseDetailsModal from '../components/ExpenseDetailsModal'

const categoryCache = {}

export default function Category() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const isAllTime = searchParams.get('allTime') === 'true'
  
  const [category, setCategory] = useState(null)
  const [subcategories, setSubcategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [expandedSubs, setExpandedSubs] = useState([])
  const [visibleCounts, setVisibleCounts] = useState({})
  
  const [selectedExpenseId, setSelectedExpenseId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    const cacheKey = `${id}-${month}-${year}-${isAllTime}`

    if (categoryCache[cacheKey]) {
      setCategory(categoryCache[cacheKey].category)
      setSubcategories(categoryCache[cacheKey].subcategories)
      setExpenses(categoryCache[cacheKey].expenses)
      setLoading(false)
    } else {
      setLoading(true)
    }
    
    const { data: catData } = await supabase.from('categories').select('*').eq('id', id).single()
    const { data: subData } = await supabase.from('subcategories').select('*').eq('category_id', id)

    if (subData) {
      subData.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    }

    let filteredExpenses = []
    if (subData && subData.length > 0) {
      const subIds = subData.map(s => s.id)
      
      let query = supabase.from('expenses')
        .select(`id, quantity, price, expense_date, created_at, products ( id, name, unit, unit_value, subcategory_id, is_mandatory ), stores ( name )`)
        .order('expense_date', { ascending: false }).order('created_at', { ascending: false })
      
      if (!isAllTime && month && year) {
        const start = new Date(year, month, 1)
        const end = new Date(year, parseInt(month) + 1, 0)
        
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        
        query = query.gte('expense_date', startStr).lte('expense_date', endStr)
      }

      const { data: expData } = await query
      filteredExpenses = (expData || []).filter(exp => exp.products && subIds.includes(exp.products.subcategory_id))
    }
    
    categoryCache[cacheKey] = { category: catData, subcategories: subData, expenses: filteredExpenses }
    setCategory(catData)
    setSubcategories(subData)
    setExpenses(filteredExpenses)
    setLoading(false)
  }

  const handleToggleSub = (subId) => {
    setExpandedSubs(prev => prev.includes(subId) ? prev.filter(i => i !== subId) : [...prev, subId])
    if (!visibleCounts[subId]) {
      setVisibleCounts(prev => ({ ...prev, [subId]: 10 }))
    }
  }

  const getPriceColorClass = (expense, allExpensesInSubcategory) => {
    const product = expense.products
    if (!product) return 'text-gray-500'
    const pricePerUnit = expense.price / expense.quantity / product.unit_value
    const comparablePrices = allExpensesInSubcategory.filter(e => e.products?.unit === product.unit).map(e => e.price / e.quantity / e.products.unit_value)
    if (comparablePrices.length < 3) return 'text-gray-500'
    const minPrice = Math.min(...comparablePrices)
    const maxPrice = Math.max(...comparablePrices)
    if (maxPrice === minPrice) return 'text-gray-500'
    const ratio = (pricePerUnit - minPrice) / (maxPrice - minPrice)
    if (ratio < 0.25) return 'text-green-500'
    if (ratio < 0.45) return 'text-green-400/80'
    if (ratio > 0.85) return 'text-red-500'
    if (ratio > 0.65) return 'text-orange-400'
    return 'text-gray-400'
  }

  if (loading && !category) return <div className="p-6 text-center text-gray-500">Загрузка...</div>

  return (
    <div className="space-y-4 pb-6 relative">
      <header className="flex items-center gap-4 pt-4 pb-2 safe-top">
        <button onClick={() => navigate(-1)} className="p-2 bg-[#1E1E1E] rounded-xl text-gray-400 hover:text-white transition-colors active:scale-95"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{category?.name}</h1>
          <p className="text-[#6366F1] text-xs">Все траты</p>
        </div>
      </header>

      <div className="space-y-3 relative">
        {subcategories.map(sub => {
          const isExpanded = expandedSubs.includes(sub.id)
          const subExpenses = expenses.filter(e => e.products?.subcategory_id === sub.id)
          const visibleCount = visibleCounts[sub.id] || 10
          const visibleExpenses = subExpenses.slice(0, visibleCount)
          
          return (
            <div key={sub.id} className={`rounded-xl transition-all border ${isExpanded ? 'bg-[#18181B] border-[#3F3F46]' : 'bg-[#1E1E1E] border-[#2A2A2A]'}`}>
              <div onClick={() => handleToggleSub(sub.id)} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-[#2A2A2A]/50 transition-colors ${isExpanded ? 'sticky -top-4 z-10 bg-[#18181B]/95 backdrop-blur-md border-b border-[#2A2A2A] rounded-t-xl' : 'rounded-xl'}`}>
                <div className="flex items-center gap-3"><span className="text-gray-400">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span><span className="font-medium">{sub.name}</span></div>
                <span className="text-xs text-gray-500 bg-[#121212] px-2 py-1 rounded-md border border-[#2A2A2A]">{subExpenses.length} трат</span>
              </div>

              {isExpanded && (
                <div className="bg-[#121212]/30 p-2 space-y-2 rounded-b-xl">
                  {subExpenses.length === 0 ? <div className="text-center text-xs text-gray-500 py-4">Трат пока нет</div> : (
                    <>
                      {visibleExpenses.map(expense => {
                        const p = expense.products
                        const colorClass = getPriceColorClass(expense, subExpenses)
                        const storeName = expense.stores?.name || 'Магазин не указан'

                        return (
                          <div key={expense.id} onClick={() => setSelectedExpenseId(expense.id)} className="flex items-center justify-between bg-[#1E1E1E] border border-[#2A2A2A] p-3 rounded-lg cursor-pointer active:scale-[0.98] transition-transform">
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">{p.is_mandatory && <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] flex-shrink-0"></span>}<p className="text-sm font-medium truncate">{p.name}</p></div>
                              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5 truncate">
                                <span className="flex items-center gap-1 text-[#6366F1]/80 truncate"><Store size={10} className="flex-shrink-0" /><span className="truncate">{storeName}</span></span>
                                <span className="flex-shrink-0 text-gray-600">•</span>
                                <span className="flex-shrink-0 whitespace-nowrap">{new Date(expense.expense_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, {new Date(expense.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-medium ${colorClass}`}>{(expense.price / expense.quantity / p.unit_value).toFixed(1)} ₸/{p.unit}</span>
                                <span className="text-xs text-gray-400">{parseFloat(expense.quantity) !== 1 ? `${expense.quantity} х ${p.unit_value}` : p.unit_value} {p.unit}</span>
                              </div>
                              <div className="text-sm font-bold w-16 text-right">{expense.price} ₸</div>
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex gap-2 pt-2 pb-1">
                        {subExpenses.length > visibleCount && (
                          <button onClick={() => setVisibleCounts(prev => ({...prev, [sub.id]: prev[sub.id] + 10}))} className="flex-1 bg-[#2A2A2A] text-gray-300 text-xs py-3 rounded-lg active:scale-95">Показать еще</button>
                        )}
                        <button onClick={() => handleToggleSub(sub.id)} className="flex items-center justify-center bg-red-500/10 text-red-500 px-4 py-3 rounded-lg active:scale-95"><ChevronUp size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <ExpenseDetailsModal 
        expenseId={selectedExpenseId} 
        onClose={(wasModified) => {
          setSelectedExpenseId(null)
          
          if (wasModified) {
            const cacheKey = `${id}-${month}-${year}-${isAllTime}`
            delete categoryCache[cacheKey]
            fetchData()
          }
        }} 
      />
    </div>
  )
}