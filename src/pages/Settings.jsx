import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Trash2, ChevronDown, ChevronRight, Tags } from 'lucide-react'

const settingsCache = { categories: null, subcategories: null }

export default function Settings() {
    const [categories, setCategories] = useState([])
    const [subcategories, setSubcategories] = useState([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newSubcategoryNames, setNewSubcategoryNames] = useState({})
    const [expandedCategory, setExpandedCategory] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
    if (settingsCache.categories) {
      setCategories(settingsCache.categories)
      setSubcategories(settingsCache.subcategories)
      setLoading(false)
    } else {
      setLoading(true)
    }
    
    const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true })
    const { data: subs } = await supabase.from('subcategories').select('*').order('created_at', { ascending: true })
    
    if (cats) {
      settingsCache.categories = cats
      setCategories(cats)
    }
    if (subs) {
      settingsCache.subcategories = subs
      setSubcategories(subs)
    }
    setLoading(false)
  }

    const handleAddCategory = async (e) => {
        e.preventDefault()
        if (!newCategoryName.trim()) return

        const { data, error } = await supabase
            .from('categories')
            .insert([{ name: newCategoryName.trim() }])
            .select()

        if (!error && data) {
            setCategories([...categories, data[0]])
            setNewCategoryName('')
        }
    }

    const handleDeleteCategory = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Удалить категорию? Все связанные подкатегории и траты тоже удалятся.')) return

        await supabase.from('categories').delete().eq('id', id)
        setCategories(categories.filter(c => c.id !== id))
    }

    const handleAddSubcategory = async (categoryId, e) => {
        e.preventDefault()
        const name = newSubcategoryNames[categoryId]
        if (!name || !name.trim()) return

        const { data, error } = await supabase
            .from('subcategories')
            .insert([{ category_id: categoryId, name: name.trim() }])
            .select()

        if (!error && data) {
            setSubcategories([...subcategories, data[0]])
            setNewSubcategoryNames({ ...newSubcategoryNames, [categoryId]: '' })
        }
    }

    const handleDeleteSubcategory = async (id) => {
        if (!window.confirm('Удалить подкатегорию?')) return
        await supabase.from('subcategories').delete().eq('id', id)
        setSubcategories(subcategories.filter(s => s.id !== id))
    }

    const toggleCategory = (id) => {
        setExpandedCategory(expandedCategory === id ? null : id)
    }

    return (
        <div className="space-y-6 pb-6">
            <header className="pt-4 pb-2">
                <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                <p className="text-gray-400 text-sm mt-1">Управление категориями</p>
            </header>

            <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Новая категория (напр. Продукты)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6366F1] transition-colors"
                />
                <button
                    type="submit"
                    disabled={!newCategoryName.trim()}
                    className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white p-3 rounded-xl transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                >
                    <Plus size={24} />
                </button>
            </form>

            {loading ? (
                <div className="text-center text-gray-500 py-8">Загрузка...</div>
            ) : (
                <div className="space-y-3">
                    {categories.map((category) => {
                        const isExpanded = expandedCategory === category.id
                        const categorySubs = subcategories.filter(sub => sub.category_id === category.id)

                        return (
                            <div
                                key={category.id}
                                className={`rounded-xl overflow-hidden transition-all border ${isExpanded
                                        ? 'bg-[#18181B] border-[#3F3F46] shadow-lg shadow-black/20'
                                        : 'bg-[#1E1E1E] border-[#2A2A2A]'
                                    }`}
                            >
                                <div
                                    onClick={() => toggleCategory(category.id)}
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#2A2A2A]/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-400">
                                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </span>
                                        <span className="font-medium text-lg">{category.name}</span>
                                        <span className="text-xs text-gray-500 bg-[#121212] px-2 py-1 rounded-full">
                                            {categorySubs.length}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteCategory(category.id, e)}
                                        className="text-red-500/50 hover:text-red-500 transition-colors p-2 rounded-lg active:scale-95"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-[#2A2A2A] bg-[#121212]/30 p-4 space-y-4">

                                        <div className="space-y-2">
                                            {categorySubs.map(sub => (
                                                <div key={sub.id} className="flex items-center justify-between bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-3">
                                                    <div className="flex items-center gap-3">
                                                        <Tags size={16} className="text-gray-500" />
                                                        <span className="text-sm">{sub.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteSubcategory(sub.id)}
                                                        className="text-red-500/50 hover:text-red-500 transition-colors p-1 active:scale-95"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {categorySubs.length === 0 && (
                                                <div className="text-center text-sm text-gray-500 py-2">Нет подкатегорий</div>
                                            )}
                                        </div>

                                        <form
                                            onSubmit={(e) => handleAddSubcategory(category.id, e)}
                                            className="flex gap-2"
                                        >
                                            <input
                                                type="text"
                                                placeholder="Новая подкатегория..."
                                                value={newSubcategoryNames[category.id] || ''}
                                                onChange={(e) => setNewSubcategoryNames({
                                                    ...newSubcategoryNames,
                                                    [category.id]: e.target.value
                                                })}
                                                className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366F1] transition-colors"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!newSubcategoryNames[category.id]?.trim()}
                                                className="bg-[#2A2A2A] hover:bg-[#3A3A3A] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors cursor-pointer active:scale-95"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </form>

                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}