import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Save, Star, Store } from 'lucide-react'
import { supabase } from '../supabaseClient'

const modalCache = {}
const UNITS = ['шт', 'кг', 'гр', 'л', 'мл']

const getEmptyBlock = () => ({
  id: crypto.randomUUID(),
  productId: null,
  name: '',
  subcategoryId: '',
  newSubcategoryName: '',
  manualSubcategory: false,
  price: '',
  unitValue: '',
  unit: 'шт',
  quantity: 1,
  isMandatory: false,
})

export default function AddExpenseModal({ category, onClose }) {
  const [blocks, setBlocks] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [knownProducts, setKnownProducts] = useState([])
  const [storePrices, setStorePrices] = useState([])
  
  const [allStores, setAllStores] = useState([])
  const [linkedStoreIds, setLinkedStoreIds] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [newStoreName, setNewStoreName] = useState('')
  const [selectedOtherStoreId, setSelectedOtherStoreId] = useState('')

  const [error, setError] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [focusedBlockId, setFocusedBlockId] = useState(null)

  useEffect(() => {
    if (category) {
      setBlocks([getEmptyBlock(), getEmptyBlock(), getEmptyBlock()])
      setError('')
      fetchCategoryData(category.id)
    }
  }, [category])

  const fetchCategoryData = async (categoryId) => {
    try {
      if (modalCache[categoryId]) {
        setSubcategories(modalCache[categoryId].subs)
        setKnownProducts(modalCache[categoryId].prods)
        setAllStores(modalCache[categoryId].stores)
        setLinkedStoreIds(modalCache[categoryId].links)
        setStorePrices(modalCache[categoryId].storePrices)
        setLoadingData(false)
      } else {
        setLoadingData(true)
      }
      
      const { data: subs } = await supabase.from('subcategories').select('*').eq('category_id', categoryId)
      
      let prods = []
      let sprices = []
      
      if (subs && subs.length > 0) {
        const subIds = subs.map(s => s.id)
        const { data } = await supabase.from('products').select('*').in('subcategory_id', subIds)
        prods = data || []

        if (prods.length > 0) {
          const prodIds = prods.map(p => p.id)
          const { data: storePricesData } = await supabase.from('product_stores').select('*').in('product_id', prodIds)
          sprices = storePricesData || []
        }
      }
      
      const { data: storesData } = await supabase.from('stores').select('*').order('name')
      const { data: linksData } = await supabase.from('category_stores').select('store_id').eq('category_id', categoryId)

      modalCache[categoryId] = {
        subs: subs || [],
        prods: prods,
        stores: storesData || [],
        links: linksData ? linksData.map(l => l.store_id) : [],
        storePrices: sprices
      }
      
      setSubcategories(subs || [])
      setKnownProducts(prods)
      setAllStores(storesData || [])
      setLinkedStoreIds(linksData ? linksData.map(l => l.store_id) : [])
      setStorePrices(sprices)

    } catch (err) {
      console.error("Ошибка при загрузке справочников:", err)
      setError("Не удалось загрузить данные. Проверьте консоль.")
    } finally {
      setLoadingData(false) 
    }
  }

  if (!category) return null

  const linkedStores = allStores.filter(s => linkedStoreIds.includes(s.id))
  const unlinkedStores = allStores.filter(s => !linkedStoreIds.includes(s.id))

  const addBlock = () => setBlocks([...blocks, getEmptyBlock()])
  const removeBlock = (id) => blocks.length > 1 && setBlocks(blocks.filter(b => b.id !== id))

  const updateBlockField = (id, field, value) => {
    setBlocks(blocks.map(b => {
      if (b.id !== id) return b
      const updatedBlock = { ...b, [field]: value }
      if (field === 'unitValue') updatedBlock.productId = null
      return updatedBlock
    }))
    setError('')
  }

  const handleNameChange = (id, newName) => {
    setBlocks(blocks.map(b => {
      if (b.id !== id) return b
      let updatedBlock = { ...b, name: newName, productId: null }

      if (!b.manualSubcategory && newName.trim().length > 2 && b.subcategoryId !== 'new') {
        const words = newName.toLowerCase().trim().split(' ')
        const matchedSub = subcategories.find(sub => words.includes(sub.name.toLowerCase()))
        if (matchedSub) updatedBlock.subcategoryId = matchedSub.id
      }
      return updatedBlock
    }))
    setError('')
  }

  const handleSelectProduct = (blockId, product) => {
    let currentStoreId = null
    if (selectedStoreId && selectedStoreId !== 'new' && selectedStoreId !== 'other') {
      currentStoreId = selectedStoreId
    } else if (selectedStoreId === 'other' && selectedOtherStoreId) {
      currentStoreId = selectedOtherStoreId
    }

    let productPrice = product.last_price || ''
    if (currentStoreId) {
      const storeSpecificPrice = storePrices.find(
        sp => sp.product_id === product.id && sp.store_id === currentStoreId
      )
      if (storeSpecificPrice) {
        productPrice = storeSpecificPrice.last_price
      }
    }

    setBlocks(blocks.map(b => b.id !== blockId ? b : {
      ...b, 
      productId: product.id, 
      name: product.name, 
      subcategoryId: product.subcategory_id,
      price: productPrice,
      unitValue: product.unit_value || '', 
      unit: product.unit || 'шт',
      isMandatory: product.is_mandatory || false, 
      manualSubcategory: true
    }))
    setFocusedBlockId(null)
  }

  const handleSubcategoryChange = (id, subId) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, subcategoryId: subId, manualSubcategory: true } : b))
    setError('')
  }

  const handleSave = async () => {
    if (!selectedStoreId) {
      setError('Выберите магазин или создайте новый')
      return
    }
    if (selectedStoreId === 'new' && !newStoreName.trim()) {
      setError('Введите название нового магазина')
      return
    }
    if (selectedStoreId === 'other' && !selectedOtherStoreId) {
      setError('Выберите магазин из других категорий')
      return
    }

    const activeBlocks = blocks.filter(b => b.name.trim() || b.price || b.unitValue)
    if (activeBlocks.length === 0) {
      onClose()
      return
    }

    const hasInvalidBlocks = activeBlocks.some(b => 
      !b.name.trim() || !b.price || !b.unitValue || !b.subcategoryId || 
      (b.subcategoryId === 'new' && !b.newSubcategoryName.trim())
    )
    if (hasInvalidBlocks) {
      setError('Заполните все поля, включая названия новых подкатегорий')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      let finalStoreId = null

      if (selectedStoreId === 'new') {
        const { data: newStore } = await supabase.from('stores').insert([{ name: newStoreName.trim() }]).select()
        finalStoreId = newStore[0].id
        await supabase.from('category_stores').insert([{ category_id: category.id, store_id: finalStoreId }])
      } 
      else if (selectedStoreId === 'other') {
        finalStoreId = selectedOtherStoreId
        const { data: linkExists } = await supabase.from('category_stores')
          .select('*').eq('category_id', category.id).eq('store_id', finalStoreId)
        if (!linkExists || linkExists.length === 0) {
          await supabase.from('category_stores').insert([{ category_id: category.id, store_id: finalStoreId }])
        }
      } 
      else {
        finalStoreId = selectedStoreId
      }

      for (const block of activeBlocks) {
        let finalSubcategoryId = block.subcategoryId

        if (block.subcategoryId === 'new') {
          const { data: newSub } = await supabase.from('subcategories')
            .insert([{ category_id: category.id, name: block.newSubcategoryName.trim() }]).select()
          finalSubcategoryId = newSub[0].id
        }

        const productName = block.name.trim()
        const price = parseFloat(block.price)
        const unitValue = parseFloat(block.unitValue)
        const quantity = parseFloat(block.quantity)

        let finalProductId = block.productId

        if (!finalProductId) {
          const exactMatch = knownProducts.find(p => 
            p.name.toLowerCase() === productName.toLowerCase() && 
            p.subcategory_id === finalSubcategoryId &&
            p.unit === block.unit && parseFloat(p.unit_value) === unitValue
          )
          if (exactMatch) finalProductId = exactMatch.id
        }

        if (finalProductId) {
          await supabase.from('products').update({ 
            last_price: price, is_mandatory: block.isMandatory, unit: block.unit, subcategory_id: finalSubcategoryId
          }).eq('id', finalProductId)
        } else {
          const { data: newProduct } = await supabase.from('products').insert([{
            subcategory_id: finalSubcategoryId, name: productName, unit: block.unit,
            unit_value: unitValue, last_price: price, is_mandatory: block.isMandatory
          }]).select()
          finalProductId = newProduct[0].id
        }

        await supabase.from('product_stores').upsert({
          product_id: finalProductId,
          store_id: finalStoreId,
          last_price: price,
          updated_at: new Date().toISOString()
        }, { onConflict: 'product_id, store_id' })

        await supabase.from('expenses').insert([{
          product_id: finalProductId, quantity: quantity, price: price, store_id: finalStoreId
        }])
      }
      
      delete modalCache[category.id]

      onClose()
    } catch (err) {
      console.error(err)
      setError('Ошибка при сохранении: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const getSuggestions = (input) => {
    if (!input || input.length < 2) return []
    return knownProducts.filter(p => p.name.toLowerCase().includes(input.toLowerCase().trim()))
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col sm:max-w-md sm:mx-auto sm:border-x sm:border-[#2A2A2A] animate-in slide-in-from-bottom-full duration-200">
      <header className="flex justify-between items-center px-3 pb-3 bg-[#1E1E1E] border-b border-[#2A2A2A] safe-top">
        <div>
          <h2 className="text-lg font-bold">Новые траты</h2>
          <p className="text-xs text-[#6366F1]">{category.name}</p>
        </div>
        <button onClick={onClose} className="p-2 bg-[#2A2A2A] rounded-full text-gray-400 hover:text-white cursor-pointer active:scale-95">
          <X size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-24 relative">
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs p-2 rounded-lg text-center">{error}</div>}
        {loadingData && <div className="text-center text-xs text-gray-500">Загрузка справочников...</div>}

        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Store size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Название магазина</span>
          </div>
          <select 
            value={selectedStoreId} 
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1] mb-2"
          >
            <option value="" disabled>Выберите магазин</option>
            {linkedStores.length > 0 && (
              <optgroup label="Прикрепленные к категории">
                {linkedStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            )}
            <option value="other">Выбрать из других категорий...</option>
            <option value="new">+ Новый магазин</option>
          </select>

          {selectedStoreId === 'new' && (
            <input 
              type="text" placeholder="Название нового магазина" value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1] animate-in fade-in"
            />
          )}
          {selectedStoreId === 'other' && (
            <select 
              value={selectedOtherStoreId} onChange={e => setSelectedOtherStoreId(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1] animate-in fade-in"
            >
              <option value="" disabled>Выберите магазин</option>
              {unlinkedStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {blocks.map((block) => {
          const suggestions = getSuggestions(block.name)
          const showSuggestions = focusedBlockId === block.id && suggestions.length > 0 && !block.productId

          return (
            <div key={block.id} className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-2.5 relative group">
              {blocks.length > 1 && (
                <button onClick={() => removeBlock(block.id)} className="absolute -top-2.5 -right-2.5 bg-[#2A2A2A] border border-[#3F3F46] text-red-500 p-1 rounded-full cursor-pointer z-10"><Trash2 size={14} /></button>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-start">
                  <button onClick={() => updateBlockField(block.id, 'isMandatory', !block.isMandatory)} className={`mt-0.5 p-1.5 rounded-lg transition-colors cursor-pointer active:scale-90 flex-shrink-0 ${block.isMandatory ? 'bg-[#6366F1]/20 text-[#6366F1]' : 'bg-[#121212] border border-[#2A2A2A] text-gray-500'}`}>
                    <Star size={16} fill={block.isMandatory ? "currentColor" : "none"} />
                  </button>

                  <div className="relative flex-1">
                    <input type="text" placeholder="Название продукта" value={block.name} onChange={(e) => handleNameChange(block.id, e.target.value)} onFocus={() => setFocusedBlockId(block.id)} onBlur={() => setTimeout(() => setFocusedBlockId(null), 150)} className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#6366F1]" />
                    {showSuggestions && (
                      <ul className="absolute z-20 top-full left-0 w-full mt-1 bg-[#1E1E1E] border border-[#3F3F46] rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {suggestions.map(p => (
                          <li key={p.id} onMouseDown={() => handleSelectProduct(block.id, p)} className="px-3 py-2 text-sm text-gray-300 hover:bg-[#2A2A2A] hover:text-white cursor-pointer flex justify-between items-center">
                            <span className="truncate">{p.name}</span><span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{p.unit_value} {p.unit}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="w-1/3 flex flex-col gap-1">
                    <select value={block.subcategoryId} onChange={(e) => handleSubcategoryChange(block.id, e.target.value)} className={`bg-[#121212] border border-[#2A2A2A] rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:border-[#6366F1] ${block.subcategoryId ? 'text-white' : 'text-gray-500'}`}>
                      <option value="" disabled>Подкатегория</option>
                      {subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                      <option value="new" className="text-[#6366F1]">+ Новая</option>
                    </select>
                  </div>
                </div>

                {block.subcategoryId === 'new' && (
                  <div className="ml-9 animate-in fade-in slide-in-from-top-1">
                    <input type="text" placeholder="Название новой подкатегории" value={block.newSubcategoryName} onChange={e => updateBlockField(block.id, 'newSubcategoryName', e.target.value)} className="w-full bg-[#121212] border border-[#6366F1]/50 rounded-lg px-2.5 py-1.5 text-xs text-[#6366F1] focus:outline-none focus:border-[#6366F1]" />
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 ml-9">
                  <input type="number" step="any" inputMode="decimal" placeholder="Цена" value={block.price} onChange={(e) => updateBlockField(block.id, 'price', e.target.value)} className="col-span-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[#6366F1]" />
                  <input type="number" step="any" inputMode="decimal" placeholder="Объем" value={block.unitValue} onChange={(e) => updateBlockField(block.id, 'unitValue', e.target.value)} className="col-span-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[#6366F1]" />
                  <select value={block.unit} onChange={(e) => updateBlockField(block.id, 'unit', e.target.value)} className="col-span-1 bg-[#2A2A2A] border border-[#3F3F46] rounded-lg px-1 py-1.5 text-xs text-center text-white focus:outline-none">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="col-span-1 relative">
                    <span className="absolute -top-1.5 left-2 text-[8px] text-gray-500 bg-[#1E1E1E] px-1 rounded">Кол-во</span>
                    <input type="number" step="any" inputMode="decimal" value={block.quantity} onChange={(e) => updateBlockField(block.id, 'quantity', e.target.value)} className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-2 py-1.5 text-sm text-center text-white focus:outline-none focus:border-[#6366F1]" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <button onClick={addBlock} className="w-full py-2 border border-dashed border-[#2A2A2A] hover:border-[#6366F1] text-gray-400 hover:text-[#6366F1] rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-95 transition-colors">
          <Plus size={16} /><span>Еще товар</span>
        </button>
      </main>

      <footer className="p-3 bg-[#1E1E1E] border-t border-[#2A2A2A] pb-safe">
        <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#6366F1]/50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-colors">
          <Save size={18} />{isSaving ? 'Сохранение...' : 'Сохранить чек'}
        </button>
      </footer>
    </div>
  )
}