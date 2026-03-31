import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'
import { ChevronLeft, BarChart3, PieChart as PieIcon, Filter, Check, X } from 'lucide-react'

const COLORS = ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#14B8A6', '#F43F5E', '#84CC16']

const formatCompact = (num) => {
  if (!num) return '' 
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'М'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'К'
  return num.toString()
}

const getMonthsRange = (expenses) => {
  const now = new Date()
  let minDate = new Date(now.getFullYear(), now.getMonth() - 4, 1) 
  
  if (expenses && expenses.length > 0) {
    const earliest = new Date(Math.min(...expenses.map(e => new Date(e.expense_date))))
    const earliestMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    if (earliestMonth < minDate) minDate = earliestMonth 
  }
  
  const result = []
  let current = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  
  while (current >= minDate) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    result.push(`${y}-${m}`)
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1)
  }
  return result 
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].value > 0) {
    return (
      <div className="bg-[#18181B]/95 backdrop-blur-sm border border-[#2A2A2A] p-3 rounded-xl shadow-2xl z-50">
        <p className="text-gray-400 text-xs uppercase mb-1">{label || payload[0].payload.name}</p>
        <p className="text-white font-bold text-lg">{payload[0].value.toLocaleString('ru-RU')} ₸</p>
      </div>
    )
  }
  return null
}

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null 
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold" style={{ pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function Stats() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonths, setSelectedMonths] = useState([])
  const [availableCategories, setAvailableCategories] = useState([])
  const [selectedCategories, setSelectedCategories] = useState([])
  
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [mandatoryFilter, setMandatoryFilter] = useState('all') 
  const [rootViewType, setRootViewType] = useState('bar') 

  const [stack, setStack] = useState([{ level: 'root', title: 'Статистика' }])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: expData } = await supabase.from('expenses').select('*, products(*)')
    const { data: catsData } = await supabase.from('categories').select('*')
    const { data: subsData } = await supabase.from('subcategories').select('*')

    if (expData && catsData && subsData) {
      const enriched = expData.map(e => {
        const p = e.products
        const sub = subsData.find(s => s.id === p.subcategory_id)
        const cat = catsData.find(c => c.id === sub?.category_id)
        const d = new Date(e.expense_date)
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { ...e, product: p, subcategory: sub, category: cat, monthStr }
      }).filter(e => e.category && e.subcategory)
      
      setExpenses(enriched)

      const monthsRange = getMonthsRange(enriched)
      setAvailableMonths(monthsRange)
      setSelectedMonths(monthsRange.slice(0, 6)) 

      const uniqueCats = catsData.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      setAvailableCategories(uniqueCats)
      setSelectedCategories(uniqueCats.map(c => c.id))
    }
    setLoading(false)
  }

  const { chartData, currentView, totalSum } = useMemo(() => {
    const view = stack[stack.length - 1]
    
    let filtered = expenses.filter(e => {
      if (mandatoryFilter === 'mandatory' && !e.product.is_mandatory) return false
      if (mandatoryFilter === 'optional' && e.product.is_mandatory) return false
      if (!selectedCategories.includes(e.category.id)) return false

      const activeMonth = stack.find(s => s.level === 'month')?.payload
      if (activeMonth) {
        if (e.monthStr !== activeMonth) return false
      } else {
        if (!selectedMonths.includes(e.monthStr)) return false
      }

      return true
    })

    let aggregated = {}

    if (view.level === 'root' && rootViewType === 'bar') {
      selectedMonths.forEach(m => {
        aggregated[m] = 0
      })
      filtered.forEach(e => {
        if (aggregated[e.monthStr] !== undefined) aggregated[e.monthStr] += e.price
      })
    } 
    else if ((view.level === 'root' && rootViewType === 'pie') || view.level === 'month') {
      filtered.forEach(e => {
        const key = e.category.id
        if (!aggregated[key]) aggregated[key] = { name: e.category.name, value: 0, payload: key }
        aggregated[key].value += e.price
      })
    } 
    else if (view.level === 'category') {
      filtered.filter(e => e.category.id === view.payload).forEach(e => {
        const key = e.subcategory.id
        if (!aggregated[key]) aggregated[key] = { name: e.subcategory.name, value: 0, payload: key }
        aggregated[key].value += e.price
      })
    } 
    else if (view.level === 'subcategory') {
      filtered.filter(e => e.subcategory.id === view.payload).forEach(e => {
        const key = e.product.id
        if (!aggregated[key]) aggregated[key] = { name: e.product.name, value: 0, payload: key }
        aggregated[key].value += e.price
      })
    }

    let result = Object.values(aggregated)
    
    if (view.level === 'root' && rootViewType === 'bar') {
      result = Object.keys(aggregated).sort().map(k => {
        const [y, m] = k.split('-')
        let name = new Date(y, parseInt(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
        name = name.replace(' г.', '') 
        return { name, value: aggregated[k], payload: k }
      })
    } else {
      result.sort((a, b) => b.value - a.value)
    }

    const total = result.reduce((sum, item) => sum + item.value, 0)
    if (view.level !== 'root' || rootViewType === 'pie') {
      result = result.map(item => ({ ...item, percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0 }))
    }

    return { chartData: result, currentView: view, totalSum: total }
  }, [expenses, stack, mandatoryFilter, rootViewType, selectedMonths, selectedCategories])

  const handleDrillDown = (payloadId, value) => {
    if (!payloadId || value === 0) return 
    const data = chartData.find(d => d.payload === payloadId)
    if (!data) return

    if (currentView.level === 'root' && rootViewType === 'bar') {
      const [y, m] = data.payload.split('-')
      const title = new Date(y, parseInt(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
      setStack([...stack, { level: 'month', payload: data.payload, title: title.charAt(0).toUpperCase() + title.slice(1) }])
    } 
    else if (currentView.level === 'root' || currentView.level === 'month') {
      setStack([...stack, { level: 'category', payload: data.payload, title: data.name }])
    } 
    else if (currentView.level === 'category') {
      setStack([...stack, { level: 'subcategory', payload: data.payload, title: data.name }])
    }
  }

  const handleBack = () => {
    if (stack.length > 1) setStack(stack.slice(0, -1))
  }

  const toggleMonth = (m) => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const toggleCategory = (id) => setSelectedCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  if (loading) return <div className="p-6 text-center text-gray-500 py-20 animate-pulse">Анализируем данные...</div>

  return (
    <div className="space-y-4 pb-6">
      
      <header className="flex flex-col pt-4 pb-2 safe-top">
        <div className="flex items-center gap-2 mb-4">
          {stack.length > 1 && (
            <button onClick={handleBack} className="p-2 bg-[#1E1E1E] rounded-xl text-gray-400 hover:text-white transition-colors active:scale-95">
              <ChevronLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight truncate flex-1">
            {currentView.title}
          </h1>
          
          {currentView.level === 'root' && (
            <button 
              onClick={() => setIsFiltersOpen(!isFiltersOpen)} 
              className={`p-2 rounded-xl transition-colors active:scale-95 border ${isFiltersOpen ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400'}`}
            >
              <Filter size={18} />
            </button>
          )}
        </div>

        {isFiltersOpen && currentView.level === 'root' && (
          <div className="bg-[#18181B] border border-[#2A2A2A] rounded-2xl p-4 mb-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Месяцы</span>
                <button onClick={() => setSelectedMonths(availableMonths)} className="text-xs text-[#6366F1] hover:underline">Выбрать все</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {availableMonths.map(m => {
                  const [y, mo] = m.split('-')
                  const name = new Date(y, parseInt(mo) - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace(' г.', '')
                  const isActive = selectedMonths.includes(m)
                  return (
                    <button 
                      key={m} 
                      onClick={() => toggleMonth(m)} 
                      className={`px-3 py-1.5 text-sm whitespace-nowrap snap-start rounded-xl transition-colors active:scale-95 ${isActive ? 'bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1]/50' : 'bg-[#121212] border border-[#2A2A2A] text-gray-400'}`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>

            <hr className="border-[#2A2A2A]" />

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Категории</span>
                <button onClick={() => setSelectedCategories(availableCategories.map(c => c.id))} className="text-xs text-[#6366F1] hover:underline">Выбрать все</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map(c => {
                  const isActive = selectedCategories.includes(c.id)
                  return (
                    <button 
                      key={c.id} 
                      onClick={() => toggleCategory(c.id)} 
                      className={`px-3 py-1.5 text-sm rounded-xl transition-colors flex items-center gap-1.5 active:scale-95 ${isActive ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50' : 'bg-[#121212] border border-[#2A2A2A] text-gray-400'}`}
                    >
                      {isActive && <Check size={14} />} {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex bg-[#1E1E1E] p-1 rounded-xl mb-3">
          {[{ id: 'all', label: 'Все' }, { id: 'mandatory', label: 'Обязат.' }, { id: 'optional', label: 'Необязат.' }].map(f => (
            <button key={f.id} onClick={() => setMandatoryFilter(f.id)} className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${mandatoryFilter === f.id ? 'bg-[#6366F1] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {currentView.level === 'root' && (
          <div className="flex bg-[#121212] border border-[#2A2A2A] p-1 rounded-xl">
            <button onClick={() => setRootViewType('bar')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${rootViewType === 'bar' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}>
              <BarChart3 size={16} /> По месяцам
            </button>
            <button onClick={() => setRootViewType('pie')} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all ${rootViewType === 'pie' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}>
              <PieIcon size={16} /> Категории
            </button>
          </div>
        )}
      </header>

      {chartData.length === 0 ? (
        <div className="text-center text-gray-500 py-10 bg-[#1E1E1E] rounded-2xl border border-dashed border-[#2A2A2A]">Нет данных для отображения</div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <div className="text-center mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Итого за период</p>
            <p className="text-3xl font-bold text-white">{totalSum.toLocaleString('ru-RU')} ₸</p>
          </div>

          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 pt-6 shadow-sm">
            
            {currentView.level === 'root' && rootViewType === 'bar' ? (
              <div className="h-64 w-full relative -left-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#52525B" fontSize={12} tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#2A2A2A', opacity: 0.4}} isAnimationActive={false} />
                    <Bar 
                      dataKey="value" 
                      fill="#6366F1" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={60} 
                      className="cursor-pointer"
                      onClick={(data) => handleDrillDown(data.payload, data.value)}
                    >
                      <LabelList dataKey="value" position="top" fill="#9CA3AF" fontSize={11} formatter={(val) => val > 0 ? formatCompact(val) : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                      <Pie
                        data={chartData} innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none"
                        labelLine={false} label={renderCustomizedLabel} className="cursor-pointer outline-none"
                        onClick={(data) => handleDrillDown(data.payload, data.value)}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-gray-500">Долей</span>
                    <span className="font-bold text-lg">{chartData.length}</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {chartData.map((item, index) => (
                    <div 
                      key={item.payload} 
                      onClick={() => handleDrillDown(item.payload, item.value)}
                      className={`flex justify-between items-center p-3 bg-[#121212] border border-[#2A2A2A] rounded-xl transition-all ${currentView.level !== 'subcategory' ? 'cursor-pointer hover:border-[#6366F1]/50 active:scale-95' : ''}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span style={{ backgroundColor: COLORS[index % COLORS.length] }} className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"></span>
                        <span className="text-sm font-medium text-gray-200 truncate">{item.name}</span>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 ml-2">
                        <span className="text-sm font-bold text-white">{item.value.toLocaleString('ru-RU')} ₸</span>
                        <span className="text-[10px] text-gray-500 font-medium">{item.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
