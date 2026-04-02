import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  TrendingUp, TrendingDown, Bell, BellOff, Wallet, 
  ShoppingCart, Ghost, AlertCircle, ChevronRight, X, 
  ChevronDown, ChevronUp, ArrowRight, ArrowDown
} from 'lucide-react'

let insightsCache = null

const ShoppingPlanModal = ({ suggestions, onClose }) => {
  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#121212] animate-in slide-in-from-bottom-full duration-300 sm:max-w-md sm:mx-auto sm:border-x sm:border-[#2A2A2A]">
      <header className="flex justify-between items-center px-6 pb-4 pt-6 bg-[#121212]/90 backdrop-blur-md sticky top-0 z-10 border-b border-[#2A2A2A] safe-top shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">План закупок</h2>
          <p className="text-sm font-medium text-[#10B981] mt-1">
            Вы сохраните ~{totalSavings.toLocaleString('ru-RU')} ₸
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="p-2.5 bg-[#1E1E1E] border border-[#2A2A2A] rounded-full text-gray-400 hover:text-white cursor-pointer active:scale-95 transition-all"
        >
          <X size={20} />
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-5 pb-safe space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed mb-2">
          Мы нашли товары, которые вы регулярно берете дороже. Вот где их покупать выгоднее:
        </p>

        {suggestions.map((sg, i) => (
          <div key={i} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <h3 className="text-base font-semibold text-gray-100 leading-snug">{sg.product}</h3>
              <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap">
                +{sg.savings} ₸
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-2 text-sm bg-[#121212] p-3 rounded-xl border border-[#2A2A2A]">
              <div className="flex-1 min-w-0 text-center">
                <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Вы брали в</p>
                <p className="text-gray-400 line-through truncate font-medium">{sg.badStore}</p>
              </div>
              
              <div className="flex-shrink-0 flex items-center justify-center text-gray-600 px-2">
                <ArrowRight size={16} />
              </div>

              <div className="flex-1 min-w-0 text-center">
                <p className="text-[#10B981]/70 text-xs uppercase tracking-wider mb-1">Дешевле в</p>
                <p className="text-[#10B981] truncate font-bold">{sg.goodStore}</p>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default function Insights() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [inflationFilter, setInflationFilter] = useState('all') 
  
  const [isShoppingPlanOpen, setIsShoppingPlanOpen] = useState(false)
  const [isVampiresExpanded, setIsVampiresExpanded] = useState(false)

  useEffect(() => {
    const savedToggle = localStorage.getItem('cashflow_reminders')
    if (savedToggle !== null) setRemindersEnabled(savedToggle === 'true')
    fetchData()
  }, [])

  const toggleReminders = () => {
    const newState = !remindersEnabled
    setRemindersEnabled(newState)
    localStorage.setItem('cashflow_reminders', newState)
  }

  const fetchData = async () => {
    if (insightsCache) {
      setExpenses(insightsCache)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const { data } = await supabase.from('expenses').select('*, products(*, subcategories(*)), stores(*)').order('expense_date', { ascending: false })
    if (data) {
      insightsCache = data
      setExpenses(data)
    }
    setLoading(false)
  }

  const insights = useMemo(() => {
    if (!expenses.length) return null

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)

    const monthlyMandatory = {}
    expenses.forEach(e => {
      if (!e.products.is_mandatory) return
      const d = new Date(e.expense_date)
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      monthlyMandatory[monthKey] = (monthlyMandatory[monthKey] || 0) + e.price
    })
    const pastMonthsKeys = Object.keys(monthlyMandatory).sort().slice(-4, -1) 
    let predictedBudget = 0
    if (pastMonthsKeys.length > 0) {
      predictedBudget = pastMonthsKeys.reduce((sum, k) => sum + monthlyMandatory[k], 0) / pastMonthsKeys.length
    }

    const vampiresMap = {}
    expenses.filter(e => !e.products.is_mandatory && new Date(e.expense_date) >= thirtyDaysAgo).forEach(e => {
      if (!vampiresMap[e.product_id]) vampiresMap[e.product_id] = { name: e.products.name, total: 0, count: 0 }
      vampiresMap[e.product_id].total += e.price
      vampiresMap[e.product_id].count += 1
    })
    const vampires = Object.values(vampiresMap).filter(v => v.count > 1).sort((a, b) => b.total - a.total).slice(0, 10)

    const reminders = []
    if (remindersEnabled) {
      const productHistory = {}
      expenses.forEach(e => {
        if (!productHistory[e.product_id]) productHistory[e.product_id] = []
        productHistory[e.product_id].push(new Date(e.expense_date))
      })
      Object.keys(productHistory).forEach(pid => {
        const dates = productHistory[pid].sort((a, b) => b - a)
        if (dates.length >= 3) {
          const intervals = []
          for (let i = 0; i < dates.length - 1; i++) {
            intervals.push((dates[i] - dates[i+1]) / (1000 * 60 * 60 * 24))
          }
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
          const daysSinceLast = Math.floor((now - dates[0]) / (1000 * 60 * 60 * 24))
          
          if (avgInterval > 5 && daysSinceLast >= (avgInterval * 0.8) && daysSinceLast <= (avgInterval * 1.5)) {
            const productInfo = expenses.find(e => e.product_id === pid)?.products
            reminders.push({ name: productInfo.name, avgInterval: Math.round(avgInterval), daysSinceLast, isOverdue: daysSinceLast > avgInterval })
          }
        }
      })
    }

    let currentPrices = {} 
    let oldPrices = {} 
    expenses.forEach(e => {
      if (inflationFilter === 'mandatory' && !e.products.is_mandatory) return
      if (inflationFilter === 'optional' && e.products.is_mandatory) return
      const pricePerUnit = e.price / (e.quantity || 1) / (e.products.unit_value || 1)
      const date = new Date(e.expense_date)
      if (date >= thirtyDaysAgo) {
        if (!currentPrices[e.product_id]) currentPrices[e.product_id] = []
        currentPrices[e.product_id].push(pricePerUnit)
      } else if (date < ninetyDaysAgo && date >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 180)) {
        if (!oldPrices[e.product_id]) oldPrices[e.product_id] = []
        oldPrices[e.product_id].push(pricePerUnit)
      }
    })

    const inflationData = []
    Object.keys(currentPrices).forEach(pid => {
      if (oldPrices[pid]) {
        const curAvg = currentPrices[pid].reduce((a, b) => a + b, 0) / currentPrices[pid].length
        const oldAvg = oldPrices[pid].reduce((a, b) => a + b, 0) / oldPrices[pid].length
        const percentChange = ((curAvg - oldAvg) / oldAvg) * 100
        const productInfo = expenses.find(e => e.product_id === pid)?.products
        inflationData.push({ name: productInfo.name, change: percentChange, unit: productInfo.unit })
      }
    })
    
    let totalInflation = 0
    if (inflationData.length > 0) {
      totalInflation = inflationData.reduce((sum, item) => sum + item.change, 0) / inflationData.length
    }
    const topRising = [...inflationData].sort((a, b) => b.change - a.change).slice(0, 3)

    const storeSuggestions = []
    expenses.filter(e => e.stores && new Date(e.expense_date) >= thirtyDaysAgo).forEach(recentExp => {
      const recentPPU = recentExp.price / (recentExp.quantity || 1) / (recentExp.products.unit_value || 1)
      const otherStoreExps = expenses.filter(e => e.product_id === recentExp.product_id && e.store_id !== recentExp.store_id && e.stores)

      if (otherStoreExps.length > 0) {
        const storeStats = {}
        otherStoreExps.forEach(e => {
          if (!storeStats[e.store_id]) storeStats[e.store_id] = { name: e.stores.name, prices: [] }
          storeStats[e.store_id].prices.push(e.price / (e.quantity||1) / (e.products.unit_value||1))
        })

        let bestStore = null
        let bestPPU = recentPPU
        Object.values(storeStats).forEach(st => {
          const avgPPU = st.prices.reduce((a, b) => a + b, 0) / st.prices.length
          if (avgPPU < bestPPU * 0.95) { 
            bestStore = st.name
            bestPPU = avgPPU
          }
        })

        if (bestStore && !storeSuggestions.some(s => s.product === recentExp.products.name)) {
          const diffPPU = recentPPU - bestPPU
          const potentialSavings = diffPPU * (recentExp.quantity || 1) * (recentExp.products.unit_value || 1)
          if (potentialSavings > 100) { 
            storeSuggestions.push({
              product: recentExp.products.name,
              badStore: recentExp.stores.name,
              goodStore: bestStore,
              savings: Math.round(potentialSavings)
            })
          }
        }
      }
    })

    return {
      predictedBudget,
      vampires,
      reminders,
      totalInflation,
      topRising,
      storeSuggestions: storeSuggestions.sort((a, b) => b.savings - a.savings)
    }

  }, [expenses, remindersEnabled, inflationFilter])


  if (loading) return <div className="p-6 text-center text-gray-500 py-20 animate-pulse">Анализ данных...</div>
  if (!insights) return <div className="p-6 text-center text-gray-500 py-20">Недостаточно данных для инсайтов</div>

  const visibleVampires = isVampiresExpanded ? insights.vampires : insights.vampires.slice(0, 3)
  const totalShoppingSavings = insights.storeSuggestions.reduce((sum, s) => sum + s.savings, 0)

  return (
    <div className="pb-12 relative">
      <header className="flex items-center justify-between pt-4 pb-6 safe-top px-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Советы</h1>
        <button 
          onClick={toggleReminders} 
          className={`p-2.5 rounded-2xl transition-colors active:scale-95 border shadow-sm ${remindersEnabled ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-500'}`}
        >
          {remindersEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        </button>
      </header>

      <main className="flex flex-col gap-4">

        {insights.predictedBudget > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-6 flex flex-col justify-center items-center text-center shadow-sm">
              <div className="w-12 h-12 bg-[#6366F1]/10 text-[#6366F1] rounded-full flex items-center justify-center mb-4">
                <Wallet size={24} />
              </div>
              <p className="text-sm font-medium text-gray-400 mb-1">Ожидаемые базовые траты</p>
              <p className="text-3xl font-bold text-white tracking-tight">~ {insights.predictedBudget.toLocaleString('ru-RU')} ₸</p>
            </div>
          </section>
        )}

        {insights.storeSuggestions.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2.5 ml-1">
              <ShoppingCart size={16} className="text-[#10B981]" /> Оптимизация цен
            </h2>
            <div 
              onClick={() => setIsShoppingPlanOpen(true)}
              className="bg-[#1E1E1E] border border-[#2A2A2A] hover:border-[#10B981]/50 rounded-3xl p-5 cursor-pointer transition-all active:scale-[0.98] group shadow-sm flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
                  <p className="text-lg font-bold text-white">План закупки готов</p>
                </div>
                <p className="text-sm text-gray-400">
                  {insights.storeSuggestions.length} товаров • Выгода <span className="text-[#10B981] font-bold">~{totalShoppingSavings.toLocaleString('ru-RU')} ₸</span>
                </p>
              </div>
              <div className="w-10 h-10 bg-[#121212] border border-[#2A2A2A] group-hover:border-[#10B981]/30 group-hover:bg-[#10B981]/10 text-gray-400 group-hover:text-[#10B981] rounded-full flex items-center justify-center transition-colors">
                <ChevronRight size={20} />
              </div>
            </div>
          </section>
        )}

        {remindersEnabled && insights.reminders.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2.5 ml-1">
              <AlertCircle size={16} className="text-[#F59E0B]" /> Пора пополнить запасы
            </h2>
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl shadow-sm overflow-hidden p-2">
              <div className="flex flex-col gap-2">
                {insights.reminders.map((r, i) => (
                  <div key={i} className={`flex justify-between items-center p-3.5 rounded-2xl ${r.isOverdue ? 'bg-[#EF4444]/10 border border-[#EF4444]/20' : 'bg-[#121212] border border-[#2A2A2A]'}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className={`font-semibold text-base truncate mb-0.5 ${r.isOverdue ? 'text-[#EF4444]' : 'text-gray-100'}`}>{r.name}</p>
                      <p className="text-xs text-gray-500">Берете раз в {r.avgInterval} дн.</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${r.isOverdue ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#2A2A2A] text-gray-300'}`}>
                        {r.isOverdue ? 'Уже пора!' : `Осталось ~${r.avgInterval - r.daysSinceLast} дн.`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {insights.vampires.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-8">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2.5 ml-1">
              <Ghost size={16} className="text-gray-400" /> Мелкие траты (30 дн)
            </h2>
            <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl overflow-hidden shadow-sm">
              <div className="divide-y divide-[#2A2A2A]">
                {visibleVampires.map((v, i) => (
                  <div key={i} className="flex justify-between items-center p-4 hover:bg-[#2A2A2A]/20 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-base font-semibold text-gray-100 truncate mb-1">{v.name}</p>
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]"></span> {v.count} покупок
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-white">{v.total.toLocaleString('ru-RU')} ₸</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {insights.vampires.length > 3 && (
                <button 
                  onClick={() => setIsVampiresExpanded(!isVampiresExpanded)}
                  className="w-full py-4 text-sm font-medium text-gray-400 hover:text-white bg-[#18181B] border-t border-[#2A2A2A] flex items-center justify-center gap-2 transition-colors active:bg-[#2A2A2A]"
                >
                  {isVampiresExpanded ? (
                    <><ChevronUp size={16} /> Скрыть список</>
                  ) : (
                    <><ChevronDown size={16} /> Показать еще {insights.vampires.length - 3}</>
                  )}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="animate-in fade-in slide-in-from-bottom-10">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2.5 ml-1">
            {insights.totalInflation >= 0 ? <TrendingUp size={16} className="text-[#EF4444]" /> : <TrendingDown size={16} className="text-[#10B981]" />} 
            Ваша инфляция (6 мес)
          </h2>
          
          <div className="flex bg-[#1E1E1E] p-1.5 rounded-2xl mb-5 border border-[#2A2A2A] shadow-sm">
            {[{ id: 'all', label: 'Все' }, { id: 'mandatory', label: 'Обязат.' }, { id: 'optional', label: 'Необязат.' }].map(f => (
              <button key={f.id} onClick={() => setInflationFilter(f.id)} className={`flex-1 text-sm font-medium py-2 rounded-xl transition-all outline-none ${inflationFilter === f.id ? 'bg-[#6366F1] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-medium text-gray-400">В среднем цены изменились на:</span>
              <span className={`text-xl font-bold px-3 py-1.5 rounded-xl ${insights.totalInflation >= 0 ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'}`}>
                {insights.totalInflation > 0 ? '+' : ''}{insights.totalInflation.toFixed(1)}%
              </span>
            </div>

            {insights.topRising.length > 0 && (
              <div className="space-y-4 pt-5 border-t border-[#2A2A2A]">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Сильнее всего подорожали:</p>
                {insights.topRising.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 truncate pr-4">
                       <ArrowDown size={14} className="text-[#EF4444] rotate-180 flex-shrink-0"/>
                       <span className="text-gray-200 font-medium truncate">{item.name}</span>
                    </div>
                    <span className="text-[#EF4444] font-bold flex-shrink-0 bg-[#EF4444]/10 px-2 py-1 rounded-lg">
                      +{item.change.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

      {isShoppingPlanOpen && (
        <ShoppingPlanModal 
          suggestions={insights.storeSuggestions} 
          onClose={() => setIsShoppingPlanOpen(false)} 
        />
      )}

    </div>
  )
}