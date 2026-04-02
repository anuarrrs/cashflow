import { useState, useEffect } from 'react'
import { X, Store, TrendingUp, TrendingDown, Minus, Star, Trash2, Edit2, Check } from 'lucide-react'
import { supabase } from '../supabaseClient'

const expenseCache = {}
const UNITS = ['шт', 'кг', 'гр', 'л', 'мл']

export default function ExpenseDetailsModal({ expenseId, onClose }) {
  const [expense, setExpense] = useState(null)
  const [history, setHistory] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [wasModified, setWasModified] = useState(false)
  
  const [updateStorePrice, setUpdateStorePrice] = useState(true)

  useEffect(() => {
    if (expenseId) {
      setIsEditing(false)
      fetchDetails()
    }
  }, [expenseId])

  const fetchDetails = async () => {
    if (expenseCache[expenseId]) {
      const cached = expenseCache[expenseId]
      setExpense(cached.expense)
      setHistory(cached.history)
      setStores(cached.stores)
      
      const d = new Date(cached.expense.expense_date)
      const t = new Date(cached.expense.created_at)
      setFormData({
        productName: cached.expense.products.name,
        unitValue: cached.expense.products.unit_value,
        unit: cached.expense.products.unit,
        isMandatory: cached.expense.products.is_mandatory,
        price: cached.expense.price,
        quantity: cached.expense.quantity,
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
        storeId: cached.expense.store_id || ''
      })
      setLoading(false)
    } else {
      setLoading(true)
    }
    
    const { data: expData } = await supabase
      .from('expenses')
      .select('*, products(*, subcategories(name)), stores(name)')
      .eq('id', expenseId)
      .single()
    
    if (expData) {
      const { data: histData } = await supabase
        .from('expenses')
        .select('id, price, quantity, created_at, expense_date, stores(name)')
        .eq('product_id', expData.product_id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      const { data: storesData } = await supabase.from('stores').select('*').order('name')
      
      expenseCache[expenseId] = {
        expense: expData,
        history: histData || [],
        stores: storesData || []
      }

      setExpense(expData)
      setHistory(histData || [])
      if (storesData) setStores(storesData)

      const d = new Date(expData.expense_date)
      const t = new Date(expData.created_at)
      setFormData({
        productName: expData.products.name,
        unitValue: expData.products.unit_value,
        unit: expData.products.unit,
        isMandatory: expData.products.is_mandatory,
        price: expData.price,
        quantity: expData.quantity,
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
        storeId: expData.store_id || ''
      })
    }
    setLoading(false)
  }

  const isPriceChanged = expense && parseFloat(formData.price) !== parseFloat(expense.price)

  useEffect(() => {
    if (!isPriceChanged) {
      setUpdateStorePrice(true)
    }
  }, [isPriceChanged])

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      await supabase.from('products').update({
        name: formData.productName,
        unit_value: parseFloat(formData.unitValue),
        unit: formData.unit,
        is_mandatory: formData.isMandatory
      }).eq('id', expense.product_id)

      const newCreatedAt = new Date(`${formData.date}T${formData.time}:00`).toISOString()
      
      const shouldUpdateStorePrice = formData.storeId && (!isPriceChanged || updateStorePrice)
      
      if (shouldUpdateStorePrice) {
        await supabase.from('product_stores').upsert({
          product_id: expense.product_id,
          store_id: formData.storeId,
          last_price: parseFloat(formData.price),
          updated_at: new Date().toISOString()
        }, { onConflict: 'product_id, store_id' })
      }

      await supabase.from('expenses').update({
        price: parseFloat(formData.price),
        quantity: parseFloat(formData.quantity),
        expense_date: formData.date,
        created_at: newCreatedAt,
        store_id: formData.storeId || null
      }).eq('id', expense.id)

      delete expenseCache[expenseId]

      setWasModified(true)
      setIsEditing(false)
      fetchDetails()
    } catch (error) {
      console.error('Ошибка сохранения:', error)
      alert('Ошибка при сохранении')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExpense = async (idToDelete) => {
    if (!window.confirm('Точно удалить эту трату?')) return
    await supabase.from('expenses').delete().eq('id', idToDelete)
    setWasModified(true)
    
    if (idToDelete === expenseId) {
      handleClose()
    } else {
      setHistory(history.filter(h => h.id !== idToDelete))
      if (expenseCache[expenseId]) {
        expenseCache[expenseId].history = expenseCache[expenseId].history.filter(h => h.id !== idToDelete)
      }
    }
  }

  const handleClose = () => {
    onClose(wasModified)
  }

  if (!expenseId) return null

  const p = expense?.products

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 backdrop-blur-sm animate-in fade-in duration-200" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }} onClick={handleClose}></div>
      
      <div className="relative z-10 bg-[#121212] border-t border-[#2A2A2A] rounded-t-3xl flex flex-col max-h-[90vh] sm:max-w-md sm:mx-auto w-full animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка информации...</div>
        ) : !expense ? (
          <div className="p-8 text-center text-red-500">Ошибка: данные не найдены</div>
        ) : (
          <>
            <header className="p-5 border-b border-[#2A2A2A] relative shrink-0 bg-[#18181B] rounded-t-3xl">
              <button onClick={handleClose} className="absolute top-5 right-5 p-2 bg-[#2A2A2A] rounded-full text-gray-400 hover:text-white active:scale-95 cursor-pointer z-10">
                <X size={18} />
              </button>
              
              {!isEditing ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 pr-8">
                    {p?.is_mandatory && <span className="bg-[#6366F1]/20 text-[#6366F1] p-1 rounded-md"><Star size={12} fill="currentColor" /></span>}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{p?.subcategories?.name}</span>
                    <button onClick={() => setIsEditing(true)} className="ml-2 text-gray-500 hover:text-white p-1 bg-[#2A2A2A] rounded-md transition-colors active:scale-90 cursor-pointer">
                      <Edit2 size={12} />
                    </button>
                  </div>
                  <h2 className="text-xl font-bold leading-tight text-white mb-3 pr-8">{p?.name}</h2>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-[#121212] border border-[#2A2A2A] p-2.5 rounded-xl">
                      <p className="text-gray-500 text-[10px] uppercase mb-0.5">Сумма чека</p>
                      <p className="font-bold text-lg text-white">{expense.price} ₸</p>
                    </div>
                    <div className="bg-[#121212] border border-[#2A2A2A] p-2.5 rounded-xl">
                      <p className="text-gray-500 text-[10px] uppercase mb-0.5">Объем / Кол-во</p>
                      <p className="font-medium text-white">{p.unit_value} {p.unit} <span className="text-gray-500">x{expense.quantity}</span></p>
                    </div>
                    <div className="col-span-2 bg-[#121212] border border-[#2A2A2A] p-2.5 rounded-xl flex items-center gap-2">
                      <Store size={14} className="text-[#6366F1]" />
                      <span className="text-gray-300 font-medium truncate flex-1">{expense.stores?.name || 'Магазин не указан'}</span>
                      <span className="text-xs text-gray-500">{new Date(expense.expense_date).toLocaleDateString('ru-RU')} {new Date(expense.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2 pr-8">
                    <span className="text-xs font-bold text-[#6366F1] uppercase tracking-wider">Редактирование</span>
                    <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400 hover:text-white underline cursor-pointer transition-colors">Отмена</button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => setFormData({...formData, isMandatory: !formData.isMandatory})} className={`p-2 rounded-lg flex-shrink-0 border cursor-pointer transition-colors active:scale-90 ${formData.isMandatory ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]' : 'bg-[#121212] border-[#2A2A2A] text-gray-500'}`}>
                      <Star size={16} fill={formData.isMandatory ? "currentColor" : "none"} />
                    </button>
                    <input type="text" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" placeholder="Название" />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" step="any" inputMode="decimal" value={formData.unitValue} onChange={e => setFormData({...formData, unitValue: e.target.value})} className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" placeholder="Объем" />
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-20 bg-[#2A2A2A] border border-[#3F3F46] rounded-lg px-2 py-2 text-sm text-white focus:outline-none">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  
                  <hr className="border-[#2A2A2A] my-2" />
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute -top-2 left-2 text-[10px] bg-[#18181B] px-1 text-gray-400">Сумма</span>
                      <input type="number" step="any" inputMode="decimal" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" />
                    </div>
                    <div className="flex-1 relative">
                      <span className="absolute -top-2 left-2 text-[10px] bg-[#18181B] px-1 text-gray-400">Кол-во</span>
                      <input type="number" step="any" inputMode="decimal" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#6366F1]" />
                    <input type="time" step="300" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-24 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#6366F1]" />
                  </div>
                  
                  <select value={formData.storeId} onChange={e => setFormData({...formData, storeId: e.target.value})} className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 pr-8 text-sm text-gray-300 focus:outline-none focus:border-[#6366F1]">
                    <option value="">Без магазина</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>

                  {isPriceChanged && (
                    <label className="flex items-center gap-2 bg-[#121212] border border-[#2A2A2A] p-3 rounded-lg cursor-pointer hover:border-[#3F3F46] transition-colors animate-in fade-in">
                      <input 
                        type="checkbox" 
                        checked={updateStorePrice} 
                        onChange={(e) => setUpdateStorePrice(e.target.checked)}
                        className="accent-[#6366F1] w-4 h-4 cursor-pointer rounded"
                      />
                      <span className="text-xs text-gray-300 select-none">
                        Сделать эту цену актуальной для магазина
                      </span>
                    </label>
                  )}

                  <button onClick={handleSaveEdit} disabled={isSaving} className="w-full py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 mt-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Check size={16} /> {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              )}
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-2 pb-safe">
              <h3 className="text-xs font-medium text-gray-500 mb-3 px-1 uppercase tracking-wider">Вся история</h3>
              
              <div className="space-y-2">
                {history.map((exp, index) => {
                  const pricePerUnit = (exp.price / exp.quantity / p.unit_value).toFixed(1)
                  const olderExp = history[index + 1]
                  let trend = null
                  if (olderExp) {
                    const oldPPU = (olderExp.price / olderExp.quantity / p.unit_value).toFixed(1)
                    if (parseFloat(pricePerUnit) > parseFloat(oldPPU)) trend = 'up'
                    else if (parseFloat(pricePerUnit) < parseFloat(oldPPU)) trend = 'down'
                    else trend = 'same'
                  }

                  const storeName = exp.stores?.name || 'Магазин не указан'
                  const quantityDisplay = parseFloat(exp.quantity) !== 1 ? `${exp.quantity} х ${p.unit_value}` : p.unit_value
                  
                  const isCurrent = exp.id === expenseId
                  const cardClasses = isCurrent 
                    ? "bg-[#166534]/10 border-[#22c55e]/30 shadow-[0_0_15px_rgba(34,197,94,0.05)]" 
                    : "bg-[#1E1E1E] border-[#2A2A2A]"

                  return (
                    <div key={exp.id} className={`${cardClasses} border p-3 rounded-xl flex items-center justify-between transition-colors`}>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className={`font-bold text-base mb-0.5 ${isCurrent ? 'text-white' : 'text-gray-200'}`}>{exp.price} ₸</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1.5 truncate mb-1">
                          <Store size={10} className="flex-shrink-0" /><span className="truncate">{storeName}</span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(exp.expense_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в {new Date(exp.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end text-right">
                          <div className="flex items-center gap-1 mb-1">
                            {trend === 'up' && <TrendingUp size={12} className="text-red-500" />}
                            {trend === 'down' && <TrendingDown size={12} className="text-green-500" />}
                            {trend === 'same' && <Minus size={12} className="text-gray-500" />}
                            <span className="text-xs font-medium">{pricePerUnit} ₸/{p.unit}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 bg-[#121212] px-1.5 py-0.5 rounded">Куплено: {quantityDisplay} {p.unit}</span>
                        </div>
                        
                        <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors active:scale-90 cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  )
}