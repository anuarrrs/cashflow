import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Category from './pages/Category'
import Stats from './pages/Stats'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) setError(error.message)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

 if (session) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
            <Route path="category/:id" element={<Category />} />
          </Route>
        </Routes>
      </HashRouter>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">CashFlow</h1>
        <p className="text-gray-400 mb-8 text-sm">Strict Expense Tracker</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6366F1] transition-colors"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6366F1] transition-colors"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 transition-colors rounded-xl font-semibold mt-4"
          >
            {loading ? 'Вход...' : 'Login'}
          </button>
          
          <div className="text-center mt-4">
            <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">
              Only authorized access
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
