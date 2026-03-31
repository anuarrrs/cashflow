import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Trash2, ChevronDown, ChevronRight, Tags, Search, Edit2, Check, X, Star, Box } from 'lucide-react'

const settingsCache = { categories: null, subcategories: null, products: null }
const UNITS = ['шт', 'кг', 'гр', 'л', 'мл']

const Highlight = ({ text, q }) => {
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q})`, 'gi'))
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === q.toLowerCase() 
          ? <span key={i} className="bg-[#6366F1]/60 text-white rounded-md px-0.5">{part}</span> 
          : part
      )}
    </>
  )
}

const ProductEditModal = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: product.name,
    unitValue: product.unit_value,
    unit: product.unit,
    isMandatory: product.is_mandatory
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.unitValue) return
    setIsSaving(true)
    const updated = {
      name: formData.name.trim(),
      unit_value: parseFloat(formData.unitValue),
      unit: formData.unit,
      is_mandatory: formData.isMandatory
    }
    await supabase.from('products').update(updated).eq('id', product.id)
    onSave({ ...product, ...updated })
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative z-10 bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Редактировать продукт</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 bg-[#2A2A2A] rounded-full active:scale-95"><X size={16}/></button>
        </div>
        
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setFormData({...formData, isMandatory: !formData.isMandatory})} className={`p-2 rounded-lg flex-shrink-0 border cursor-pointer transition-colors active:scale-90 ${formData.isMandatory ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]' : 'bg-[#121212] border-[#2A2A2A] text-gray-500'}`}>
              <Star size={16} fill={formData.isMandatory ? "currentColor" : "none"} />
            </button>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" placeholder="Название" />
          </div>
          <div className="flex gap-2">
            <input type="number" step="any" inputMode="decimal" value={formData.unitValue} onChange={e => setFormData({...formData, unitValue: e.target.value})} className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]" placeholder="Объем" />
            <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-24 bg-[#2A2A2A] border border-[#3F3F46] rounded-lg px-2 py-2 text-sm text-white focus:outline-none">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="w-full py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 mt-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50">
            <Check size={16} /> {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryNames, setNewSubcategoryNames] = useState({})

  const [expandedCats, setExpandedCats] = useState([])
  const [expandedSubs, setExpandedSubs] = useState([])
  const [visibleProdCounts, setVisibleProdCounts] = useState({})

  const [editingSubId, setEditingSubId] = useState(null)
  const [editingSubName, setEditingSubName] = useState('')

  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    if (settingsCache.categories) {
      setCategories(settingsCache.categories)
      setSubcategories(settingsCache.subcategories)
      setProducts(settingsCache.products)
      setLoading(false)
    } else {
      setLoading(true)
    }
    
    const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true })
    const { data: subs } = await supabase.from('subcategories').select('*').order('name')
    const { data: prods } = await supabase.from('products').select('*').order('name')
    
    if (cats) { settingsCache.categories = cats; setCategories(cats) }
    if (subs) { settingsCache.subcategories = subs; setSubcategories(subs) }
    if (prods) { settingsCache.products = prods; setProducts(prods) }
    
    setLoading(false)
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const { data, error } = await supabase.from('categories').insert([{ name: newCategoryName.trim() }]).select()
    if (!error && data) {
      const newCats = [...categories, data[0]]
      setCategories(newCats)
      settingsCache.categories = newCats
      setNewCategoryName('')
      setShowAddCat(false)
    }
  }

  const handleDeleteCategory = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить категорию? Все подкатегории и продукты удалятся.')) return
    await supabase.from('categories').delete().eq('id', id)
    const newCats = categories.filter(c => c.id !== id)
    setCategories(newCats)
    settingsCache.categories = newCats
  }

  const handleAddSubcategory = async (categoryId, e) => {
    e.preventDefault()
    const name = newSubcategoryNames[categoryId]
    if (!name || !name.trim()) return
    const { data, error } = await supabase.from('subcategories').insert([{ category_id: categoryId, name: name.trim() }]).select()
    if (!error && data) {
      const newSubs = [...subcategories, data[0]]
      setSubcategories(newSubs)
      settingsCache.subcategories = newSubs
      setNewSubcategoryNames({ ...newSubcategoryNames, [categoryId]: '' })
    }
  }

  const handleDeleteSubcategory = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить подкатегорию? Продукты внутри нее тоже удалятся.')) return
    await supabase.from('subcategories').delete().eq('id', id)
    const newSubs = subcategories.filter(s => s.id !== id)
    setSubcategories(newSubs)
    settingsCache.subcategories = newSubs
  }

  const handleSaveSubEdit = async (id, e) => {
    e.stopPropagation()
    if (!editingSubName.trim()) { setEditingSubId(null); return }
    await supabase.from('subcategories').update({ name: editingSubName.trim() }).eq('id', id)
    const newSubs = subcategories.map(s => s.id === id ? { ...s, name: editingSubName.trim() } : s)
    setSubcategories(newSubs)
    settingsCache.subcategories = newSubs
    setEditingSubId(null)
  }

  const handleProductSaved = (updatedProduct) => {
    const newProds = products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
    setProducts(newProds)
    settingsCache.products = newProds
    setEditingProduct(null)
  }

  const q = searchQuery.toLowerCase().trim()
  
  const filteredCats = categories.filter(cat => {
    if (!q) return true
    if (cat.name.toLowerCase().includes(q)) return true
    const catSubs = subcategories.filter(s => s.category_id === cat.id)
    if (catSubs.some(s => s.name.toLowerCase().includes(q))) return true
    return products.some(p => p.name.toLowerCase().includes(q) && catSubs.some(s => s.id === p.subcategory_id))
  })

  return (
    <div className="space-y-6 pb-6 relative">
      <header className="pb-2 safe-top">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Справочники</h1>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Поиск по продуктам, подкатегориям, категориям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#6366F1] transition-colors"
          />
        </div>

        {!showAddCat ? (
          <button 
            onClick={() => setShowAddCat(true)}
            className="mt-3 text-xs font-medium text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-1 bg-[#6366F1]/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <Plus size={14} /> Добавить новую категорию
          </button>
        ) : (
          <form onSubmit={handleAddCategory} className="flex gap-2 mt-3 animate-in fade-in slide-in-from-top-2">
            <input
              type="text" autoFocus
              placeholder="Название категории"
              value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1]"
            />
            <button type="submit" disabled={!newCategoryName.trim()} className="bg-[#6366F1] text-white px-3 rounded-lg active:scale-95 disabled:opacity-50"><Check size={18}/></button>
            <button type="button" onClick={() => setShowAddCat(false)} className="bg-[#2A2A2A] text-gray-400 px-3 rounded-lg active:scale-95"><X size={18}/></button>
          </form>
        )}
      </header>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {filteredCats.map((category) => {
            const isCatExpanded = q ? true : expandedCats.includes(category.id)
            const catSubs = subcategories.filter(sub => sub.category_id === category.id).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            
            const filteredSubs = catSubs.filter(sub => {
              if (!q || category.name.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q)) return true
              return products.some(p => p.subcategory_id === sub.id && p.name.toLowerCase().includes(q))
            })

            return (
              <div key={category.id} className={`rounded-xl transition-all border ${isCatExpanded ? 'bg-[#18181B] border-[#3F3F46]' : 'bg-[#1E1E1E] border-[#2A2A2A]'}`}>
                
                <div 
                  onClick={() => setExpandedCats(prev => prev.includes(category.id) ? prev.filter(i => i !== category.id) : [...prev, category.id])}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#2A2A2A]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{isCatExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</span>
                    <span className="font-medium text-lg"><Highlight text={category.name} q={q} /></span>
                    <span className="text-[10px] text-gray-500 bg-[#121212] px-2 py-0.5 rounded-full">{catSubs.length}</span>
                  </div>
                  <button onClick={(e) => handleDeleteCategory(category.id, e)} className="text-gray-600 hover:text-red-500 p-2 rounded-lg active:scale-90"><Trash2 size={16} /></button>
                </div>

                {isCatExpanded && (
                  <div className="border-t border-[#2A2A2A] bg-[#121212]/30 p-2 space-y-2 rounded-b-xl">
                    
                    {filteredSubs.length === 0 && !q && <div className="text-center text-xs text-gray-500 py-2">Нет подкатегорий</div>}
                    
                    {filteredSubs.map(sub => {
                      const isSubExpanded = q ? true : expandedSubs.includes(sub.id)
                      const isEditing = editingSubId === sub.id
                      
                      const subProds = products.filter(p => p.subcategory_id === sub.id).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                      const filteredProds = subProds.filter(p => !q || category.name.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
                      
                      const visibleCount = visibleProdCounts[sub.id] || 10
                      const visibleProds = filteredProds.slice(0, visibleCount)

                      return (
                        <div key={sub.id} className={`bg-[#1E1E1E] border ${isSubExpanded ? 'border-[#3F3F46]' : 'border-[#2A2A2A]'} rounded-lg overflow-hidden`}>
                          
                          <div 
                            onClick={() => !isEditing && setExpandedSubs(prev => prev.includes(sub.id) ? prev.filter(i => i !== sub.id) : [...prev, sub.id])}
                            className={`flex items-center justify-between p-3 ${!isEditing && 'cursor-pointer hover:bg-[#2A2A2A]/40'} transition-colors`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-gray-500">{isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                              
                              {isEditing ? (
                                <div className="flex-1 flex gap-2 mr-2">
                                  <input type="text" autoFocus value={editingSubName} onChange={e => setEditingSubName(e.target.value)} onClick={e => e.stopPropagation()} className="flex-1 bg-[#121212] border border-[#6366F1] rounded px-2 py-1 text-sm text-white focus:outline-none" />
                                  <button onClick={(e) => handleSaveSubEdit(sub.id, e)} className="text-green-500 p-1 bg-[#121212] rounded active:scale-90"><Check size={16}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); setEditingSubId(null) }} className="text-gray-400 p-1 bg-[#121212] rounded active:scale-90"><X size={16}/></button>
                                </div>
                              ) : (
                                <span className="text-sm font-medium"><Highlight text={sub.name} q={q} /> <span className="text-sm text-gray-500 ml-1">({subProds.length})</span></span>
                              )}
                            </div>
                            
                            {!isEditing && (
                              <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); setEditingSubId(sub.id); setEditingSubName(sub.name) }} className="text-gray-500 hover:text-white p-1.5 rounded active:scale-90"><Edit2 size={14} /></button>
                                <button onClick={(e) => handleDeleteSubcategory(sub.id, e)} className="text-gray-600 hover:text-red-500 p-1.5 rounded active:scale-90"><Trash2 size={14} /></button>
                              </div>
                            )}
                          </div>

                          {isSubExpanded && (
                            <div className="bg-[#121212] p-2 space-y-1.5 border-t border-[#2A2A2A]">
                              {filteredProds.length === 0 ? <div className="text-[10px] text-gray-500 text-center py-2">Нет продуктов</div> : (
                                <>
                                  {visibleProds.map(prod => (
                                    <div 
                                      key={prod.id} 
                                      onClick={() => setEditingProduct(prod)}
                                      className="flex items-center justify-between bg-[#1E1E1E] border border-[#2A2A2A] px-3 py-2 rounded-md cursor-pointer hover:border-[#6366F1]/50 active:scale-[0.98] transition-all"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        {prod.is_mandatory ? <Star size={10} className="text-[#6366F1] flex-shrink-0" fill="currentColor" /> : <Box size={10} className="text-gray-600 flex-shrink-0" />}
                                        <span className="text-xs truncate"><Highlight text={prod.name} q={q} /></span>
                                      </div>
                                      <span className="text-[10px] text-gray-500 whitespace-nowrap bg-[#121212] px-1.5 py-0.5 rounded">{prod.unit_value} {prod.unit}</span>
                                    </div>
                                  ))}
                                  {filteredProds.length > visibleCount && (
                                    <button 
                                      onClick={() => setVisibleProdCounts(prev => ({...prev, [sub.id]: (prev[sub.id] || 10) + 10}))}
                                      className="w-full py-2 text-[10px] text-gray-400 hover:text-white bg-[#1E1E1E] rounded-md active:scale-95 transition-colors"
                                    >
                                      Показать еще ({filteredProds.length - visibleCount})
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <form onSubmit={(e) => handleAddSubcategory(category.id, e)} className="flex gap-2 mt-2 px-1">
                      <input
                        type="text" placeholder="Новая подкатегория..."
                        value={newSubcategoryNames[category.id] || ''} onChange={(e) => setNewSubcategoryNames({...newSubcategoryNames, [category.id]: e.target.value})}
                        className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#6366F1]"
                      />
                      <button type="submit" disabled={!newSubcategoryNames[category.id]?.trim()} className="bg-[#2A2A2A] text-white px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50"><Plus size={16} /></button>
                    </form>

                  </div>
                )}
              </div>
            )
          })}
          
          {filteredCats.length === 0 && (
            <div className="text-center p-8 bg-[#1E1E1E] border border-[#2A2A2A] border-dashed rounded-2xl text-gray-500">
              По запросу «{searchQuery}» ничего не найдено
            </div>
          )}
        </div>
      )}

      {editingProduct && (
        <ProductEditModal 
          product={editingProduct} 
          onClose={() => setEditingProduct(null)} 
          onSave={handleProductSaved} 
        />
      )}
    </div>
  )
}