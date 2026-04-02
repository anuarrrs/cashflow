import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Category from './pages/Category'
import Stats from './pages/Stats'
import Insights from './pages/Insights'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setAuthLoading(false)
  }

  if (loading) return null 

  if (session) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="stats" element={<Stats />} />
            <Route path="insights" element={<Insights />} />
            <Route path="settings" element={<Settings />} />
            <Route path="category/:id" element={<Category />} />
          </Route>
        </Routes>
      </HashRouter>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4 font-sans text-sm">
      <div className="max-w-md w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-1 tracking-tight">CashFlow</h1>
        <p className="text-gray-400 mb-8">Strict Expense Tracker</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 focus:outline-none focus:border-[#6366F1] transition-colors"
            required
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 focus:outline-none focus:border-[#6366F1] transition-colors"
            required
          />
          {error && <p className="text-red-500 text-center text-xs">{error}</p>}
          <button 
            type="submit" disabled={authLoading}
            className="w-full py-4 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 transition-colors rounded-xl font-semibold mt-4"
          >
            {authLoading ? 'Вход...' : 'Login'}
          </button>
          <div className="text-center mt-4 uppercase tracking-widest text-[10px] text-gray-500">Only authorized access</div>
        </form>
      </div>
    </div>
  )
}

export default App