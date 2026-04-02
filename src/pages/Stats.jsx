import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'
import { ChevronLeft, BarChart3, PieChart as PieIcon, Filter, Check, X, Store } from 'lucide-react'

let globalStatsCache = null

const COLORS = ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#14B8A6', '#F43F5E', '#84CC16', '#06B6D4', '#F97316']

const formatCompact = (num) => {
  if (!num) return '' 
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'М'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'К'
  return num.toString()
}

const formatMonthName = (year, month) => {
  let name = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }).replace(' г.', '')
  return name.charAt(0).toUpperCase() + name.slice(1)
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
  return result.reverse()
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

const ProductExpensesModal = ({ product, expenses, onClose }) => {
  const sorted = [...expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date) || new Date(b.created_at) - new Date(a.created_at))
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative z-10 bg-[#121212] border-t border-[#2A2A2A] rounded-t-3xl flex flex-col max-h-[85vh] p-5 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-full duration-300 w-full sm:max-w-md sm:mx-auto">
        <div className="flex justify-between items-center mb-5">
          <div className="pr-8">
            <h3 className="text-xl font-bold leading-tight truncate">{product.name}</h3>
            <p className="text-xs text-[#6366F1] mt-1">{expenses.length} записей</p>
          </div>
          <button onClick={onClose} className="p-2 bg-[#2A2A2A] rounded-full text-gray-400 hover:text-white active:scale-95"><X size={18}/></button>
        </div>
        
        <div className="overflow-y-auto space-y-2 pb-6 hide-scrollbar">
          {sorted.length === 0 ? <p className="text-center text-gray-500 py-10">Трат не найдено</p> : null}
          {sorted.map(exp => (
            <div key={exp.id} className="bg-[#1E1E1E] p-3 rounded-xl border border-[#2A2A2A] flex justify-between items-center">
              <div>
                <p className="font-bold text-base text-white">{exp.price} ₸</p>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                  <span className="text-[#6366F1] flex items-center gap-1 max-w-[100px] truncate"><Store size={10}/> {exp.stores?.name || 'Без магазина'}</span>
                  <span>•</span>
                  <span>{new Date(exp.expense_date).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-300">{exp.quantity} {exp.product.unit}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{(exp.price / (exp.quantity || 1) / (exp.product.unit_value || 1)).toFixed(1)} ₸/{exp.product.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Stats() {
  const chartScrollRef = useRef(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [products, setProducts] = useState([])
  const [availableMonths, setAvailableMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyStack, setHistoryStack] = useState([])
  const [viewState, setViewState] = useState(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedProductForModal, setSelectedProductForModal] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (viewState?.level === 'root' && viewState?.rootViewType === 'bar' && chartScrollRef.current) {
      const now = new Date()
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const index = viewState.selectedMonths.sort().indexOf(currentMonthKey)
      
      if (index !== -1 && viewState.selectedMonths.length > 5) {
        const itemWidth = 75
        const scrollAmount = (index * itemWidth) - (chartScrollRef.current.clientWidth / 2) + (itemWidth / 2)
        chartScrollRef.current.scrollLeft = scrollAmount
      }
    }
  }, [viewState?.level, viewState?.rootViewType, loading])

  const handleWheel = (e) => {
    if (chartScrollRef.current) {
      if (e.deltaX !== 0) return
      e.preventDefault()
      chartScrollRef.current.scrollLeft += e.deltaY
    }
  }

  const handleMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.pageX - chartScrollRef.current.offsetLeft
    scrollLeft.current = chartScrollRef.current.scrollLeft
  }

  const handleMouseLeave = () => {
    isDragging.current = false
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  const handleMouseMove = (e) => {
    if (!isDragging.current) return
    e.preventDefault()
    const x = e.pageX - chartScrollRef.current.offsetLeft
    const walk = (x - startX.current) * 2
    chartScrollRef.current.scrollLeft = scrollLeft.current - walk
  }

  const fetchData = async () => {
    if (globalStatsCache) {
      setCategories(globalStatsCache.categories)
      setSubcategories(globalStatsCache.subcategories)
      setProducts(globalStatsCache.products)
      setExpenses(globalStatsCache.expenses)
      setAvailableMonths(globalStatsCache.availableMonths)
      setViewState(prev => prev || globalStatsCache.defaultViewState)
      setLoading(false)
    } else {
      setLoading(true)
    }

    const { data: expData } = await supabase.from('expenses').select('*, products(*), stores(name)')
    const { data: catsData } = await supabase.from('categories').select('*').order('name')
    const { data: subsData } = await supabase.from('subcategories').select('*').order('name')
    const { data: prodsData } = await supabase.from('products').select('*').order('name')

    if (expData && catsData && subsData && prodsData) {
      const enriched = expData.map(e => {
        const p = e.products
        const sub = subsData.find(s => s.id === p.subcategory_id)
        const cat = catsData.find(c => c.id === sub?.category_id)
        const d = new Date(e.expense_date)
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { ...e, product: p, subcategory: sub, category: cat, monthStr }
      }).filter(e => e.category && e.subcategory)
      
      const monthsRange = getMonthsRange(enriched)
      
      globalStatsCache = {
        categories: catsData,
        subcategories: subsData,
        products: prodsData,
        expenses: enriched,
        availableMonths: monthsRange,
        defaultViewState: {
          level: 'root',
          rootViewType: 'bar',
          selectedMonths: monthsRange.slice(-6),
          selectedFilterIds: catsData.map(c => c.id),
          activePayload: null,
          title: 'Статистика',
          mandatoryFilter: 'all'
        }
      }

      setCategories(catsData)
      setSubcategories(subsData)
      setProducts(prodsData)
      setExpenses(enriched)
      setAvailableMonths(monthsRange)
      setViewState(prev => prev || globalStatsCache.defaultViewState)
    }
    setLoading(false)
  }

  const filterEntities = useMemo(() => {
    if (!viewState) return []
    if (viewState.level === 'root') return categories
    if (viewState.level === 'category') return subcategories.filter(s => s.category_id === viewState.activePayload)
    if (viewState.level === 'subcategory') return products.filter(p => p.subcategory_id === viewState.activePayload)
    return []
  }, [viewState, categories, subcategories, products])

  const filterTitle = viewState?.level === 'root' ? 'Категории' : viewState?.level === 'category' ? 'Подкатегории' : 'Продукты'

  const { chartData, totalSum } = useMemo(() => {
    if (!viewState) return { chartData: [], totalSum: 0 }
    let filtered = expenses.filter(e => {
      if (viewState.mandatoryFilter === 'mandatory' && !e.product.is_mandatory) return false
      if (viewState.mandatoryFilter === 'optional' && e.product.is_mandatory) return false
      if (!viewState.selectedMonths.includes(e.monthStr)) return false
      if (viewState.level === 'root') {
        if (!viewState.selectedFilterIds.includes(e.category.id)) return false
      } else if (viewState.level === 'category') {
        if (e.category.id !== viewState.activePayload) return false
        if (!viewState.selectedFilterIds.includes(e.subcategory.id)) return false
      } else if (viewState.level === 'subcategory') {
        if (e.subcategory.id !== viewState.activePayload) return false
        if (!viewState.selectedFilterIds.includes(e.product.id)) return false
      }
      return true
    })

    let aggregated = {}
    if (viewState.level === 'root' && viewState.rootViewType === 'bar') {
      viewState.selectedMonths.forEach(m => aggregated[m] = { name: '', value: 0, id: m })
      filtered.forEach(e => { if (aggregated[e.monthStr]) aggregated[e.monthStr].value += e.price })
    } else if ((viewState.level === 'root' && viewState.rootViewType === 'pie') || viewState.level === 'month') {
      filtered.forEach(e => {
        if (!aggregated[e.category.id]) aggregated[e.category.id] = { name: e.category.name, value: 0, id: e.category.id }
        aggregated[e.category.id].value += e.price
      })
    } else if (viewState.level === 'category') {
      filtered.forEach(e => {
        if (!aggregated[e.subcategory.id]) aggregated[e.subcategory.id] = { name: e.subcategory.name, value: 0, id: e.subcategory.id }
        aggregated[e.subcategory.id].value += e.price
      })
    } else if (viewState.level === 'subcategory') {
      filtered.forEach(e => {
        if (!aggregated[e.product.id]) aggregated[e.product.id] = { name: e.product.name, value: 0, id: e.product.id }
        aggregated[e.product.id].value += e.price
      })
    }

    let result = Object.values(aggregated)
    if (viewState.level === 'root' && viewState.rootViewType === 'bar') {
      result = result.map(item => {
        const [y, m] = item.id.split('-')
        return { ...item, name: formatMonthName(y, m) }
      }).sort((a, b) => a.id.localeCompare(b.id))
    } else {
      result = result.filter(r => r.value > 0).sort((a, b) => b.value - a.value)
    }
    
    const total = result.reduce((sum, item) => sum + item.value, 0)
    if (viewState.level !== 'root' || viewState.rootViewType === 'pie') {
      result = result.map(item => ({ ...item, percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0 }))
    }
    return { chartData: result, totalSum: total }
  }, [expenses, viewState])

  const handleDrillDown = (data) => {
    if (isDragging.current) return
    const id = data?.id || data?.payload?.id
    const value = data?.value || data?.payload?.value
    if (!id || value === 0) return 
    if (viewState.level === 'root' && viewState.rootViewType === 'bar') {
      const [y, m] = id.split('-')
      const title = new Date(y, parseInt(m) - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
      setHistoryStack([...historyStack, viewState])
      setViewState({ ...viewState, rootViewType: 'pie', selectedMonths: [id], title: title.charAt(0).toUpperCase() + title.slice(1) })
    } else if (viewState.level === 'root') {
      setHistoryStack([...historyStack, viewState])
      const subs = subcategories.filter(s => s.category_id === id).map(s => s.id)
      setViewState({ ...viewState, level: 'category', activePayload: id, selectedFilterIds: subs, title: data.name || data.payload?.name })
    } else if (viewState.level === 'category') {
      setHistoryStack([...historyStack, viewState])
      const prods = products.filter(p => p.subcategory_id === id).map(p => p.id)
      setViewState({ ...viewState, level: 'subcategory', activePayload: id, selectedFilterIds: prods, title: data.name || data.payload?.name })
    } else if (viewState.level === 'subcategory') {
      const prodName = data.name || data.payload?.name
      setSelectedProductForModal({ id, name: prodName })
    }
  }

  const handleBack = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1]
      setHistoryStack(historyStack.slice(0, -1))
      setViewState(prev)
    }
  }

  const toggleMonth = (m) => {
    setViewState(prev => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(m) ? prev.selectedMonths.filter(x => x !== m) : [...prev.selectedMonths, m]
    }))
  }
  const toggleFilterId = (id) => {
    setViewState(prev => ({
      ...prev,
      selectedFilterIds: prev.selectedFilterIds.includes(id) ? prev.selectedFilterIds.filter(x => x !== id) : [...prev.selectedFilterIds, id]
    }))
  }

  if (loading || !viewState) return <div className="p-6 text-center text-gray-500 py-20 animate-pulse">Анализируем данные...</div>

  return (
    <div className="space-y-4 pb-6">
      <header className="flex flex-col pt-4 pb-2 safe-top">
        <div className="flex items-center gap-2 mb-4">
          {historyStack.length > 0 && (
            <button onClick={handleBack} className="p-2 bg-[#1E1E1E] rounded-xl text-gray-400 hover:text-white transition-colors active:scale-95">
              <ChevronLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight truncate flex-1">{viewState.title}</h1>
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)} 
            className={`p-2 rounded-xl transition-colors active:scale-95 border ${isFiltersOpen ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400'}`}
          >
            <Filter size={18} />
          </button>
        </div>

        {isFiltersOpen && (
          <div className="bg-[#18181B] border border-[#2A2A2A] rounded-2xl p-4 mb-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Месяцы</span>
                <button onClick={() => setViewState(prev => ({...prev, selectedMonths: availableMonths}))} className="text-xs text-[#6366F1] hover:underline">Выбрать все</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {availableMonths.map(m => {
                  const isActive = viewState.selectedMonths.includes(m)
                  const [y, mo] = m.split('-')
                  return (
                    <button 
                      key={m} onClick={() => toggleMonth(m)} 
                      className={`px-3 py-1.5 text-sm whitespace-nowrap snap-start rounded-xl transition-colors active:scale-95 ${isActive ? 'bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1]/50' : 'bg-[#121212] border border-[#2A2A2A] text-gray-500'}`}
                    >
                      {formatMonthName(y, mo)}
                    </button>
                  )
                })}
              </div>
            </div>
            {filterEntities.length > 0 && (
              <>
                <hr className="border-[#2A2A2A]" />
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{filterTitle}</span>
                    <button onClick={() => setViewState(prev => ({...prev, selectedFilterIds: filterEntities.map(e => e.id)}))} className="text-xs text-[#6366F1] hover:underline">Выбрать все</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filterEntities.map(item => {
                      const isActive = viewState.selectedFilterIds.includes(item.id)
                      return (
                        <button 
                          key={item.id} onClick={() => toggleFilterId(item.id)} 
                          className={`px-3 py-1.5 text-sm rounded-xl transition-colors flex items-center gap-1.5 active:scale-95 outline-none ${isActive ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50' : 'bg-[#121212] border border-[#2A2A2A] text-gray-400'}`}
                        >
                          {isActive && <Check size={14} />} {item.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex bg-[#1E1E1E] p-1 rounded-xl mb-3">
          {[{ id: 'all', label: 'Все' }, { id: 'mandatory', label: 'Обязат.' }, { id: 'optional', label: 'Необязат.' }].map(f => (
            <button key={f.id} onClick={() => setViewState(prev => ({...prev, mandatoryFilter: f.id}))} className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all outline-none ${viewState.mandatoryFilter === f.id ? 'bg-[#6366F1] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {viewState.level === 'root' && (
          <div className="flex bg-[#121212] border border-[#2A2A2A] p-1 rounded-xl">
            <button onClick={() => setViewState(prev => ({...prev, rootViewType: 'bar'}))} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all outline-none ${viewState.rootViewType === 'bar' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}>
              <BarChart3 size={16} /> По месяцам
            </button>
            <button onClick={() => setViewState(prev => ({...prev, rootViewType: 'pie'}))} className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-all outline-none ${viewState.rootViewType === 'pie' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}>
              <PieIcon size={16} /> Категории
            </button>
          </div>
        )}
      </header>

      {chartData.length === 0 ? (
        <div className="text-center text-gray-500 py-10 bg-[#1E1E1E] rounded-2xl border border-dashed border-[#2A2A2A]">Нет данных</div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Итого за период</p>
            <p className="text-3xl font-bold text-white">{totalSum.toLocaleString('ru-RU')} ₸</p>
          </div>

          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-4 pt-6 shadow-sm">
            {viewState.level === 'root' && viewState.rootViewType === 'bar' ? (
              <div 
                ref={chartScrollRef} 
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="w-full overflow-x-auto hide-scrollbar pb-2 relative -left-2 cursor-grab active:cursor-grabbing select-none"
              >
                <div style={{ width: chartData.length > 5 ? `${chartData.length * 75}px` : '100%', height: '256px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#52525B" fontSize={13} tickLine={false} axisLine={false} tickMargin={8} interval={0} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: '#2A2A2A', opacity: 0.4}} isAnimationActive={false} />
                      <Bar 
                        dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={45} 
                        className="cursor-pointer outline-none"
                        onClick={(data) => handleDrillDown(data)}
                      >
                        <LabelList dataKey="value" position="top" fill="#9CA3AF" fontSize={11} formatter={(val) => val > 0 ? formatCompact(val) : ''} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                      <Pie
                        data={chartData} innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none"
                        labelLine={false} label={renderCustomizedLabel} 
                        className="cursor-pointer outline-none"
                        onClick={(data) => handleDrillDown(data)}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 space-y-2">
                  {chartData.map((item, index) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleDrillDown(item)}
                      className="flex justify-between items-center p-3 bg-[#121212] border border-[#2A2A2A] rounded-xl transition-all cursor-pointer hover:border-[#6366F1]/50 active:scale-95 outline-none"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span style={{ backgroundColor: COLORS[index % COLORS.length] }} className="w-3 h-3 rounded-full flex-shrink-0"></span>
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

      {selectedProductForModal && (
        <ProductExpensesModal 
          product={selectedProductForModal} 
          expenses={expenses.filter(e => e.product.id === selectedProductForModal.id && viewState.selectedMonths.includes(e.monthStr))}
          onClose={() => setSelectedProductForModal(null)}
        />
      )}
    </div>
  )
}