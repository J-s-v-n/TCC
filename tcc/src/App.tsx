import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from './firebase/config'
import HomePage from './pages/HomePage'
import TryTools from './pages/TryTools'
import Login from './pages/Login'
import Signup from './pages/Signup'

type NavItem = { label: string; to: string; type: 'hash' | 'route' }

const navItems: NavItem[] = [
  { label: 'About TCCs', to: '/#about', type: 'hash' },
  { label: 'Science', to: '/#science', type: 'hash' },
  { label: 'Algorithms', to: '/#algorithms', type: 'hash' },
  { label: 'Tools', to: '/tools', type: 'route' },
]

function ScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.replace('#', ''))
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [location])

  return null
}

function Header() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="fixed top-0 z-30 w-full border-b border-border/60 bg-[#0b1220]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accentDark text-midnight shadow-glow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M7.5 8.5 4 12l3.5 3.5M16.5 8.5 20 12l-3.5 3.5M9.5 16.5 14.5 7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-accent">AI-Powered Weather Intelligence</p>
            <h1 className="text-lg font-bold text-white">TCC Predictor</h1>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-200 md:flex">
          {navItems.map((item) =>
            item.type === 'route' ? (
              <Link
                key={item.to}
                to={item.to}
                className="relative pb-1 transition-colors hover:text-white"
              >
                {item.label}
                <span className="absolute left-0 -bottom-1 h-0.5 w-0 bg-gradient-to-r from-accent to-accentDark transition-all duration-300 hover:w-full" />
              </Link>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="relative pb-1 transition-colors hover:text-white"
              >
                {item.label}
                <span className="absolute left-0 -bottom-1 h-0.5 w-0 bg-gradient-to-r from-accent to-accentDark transition-all duration-300 hover:w-full" />
              </Link>
            ),
          )}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
                <span className="max-w-[120px] truncate">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded-xl bg-gradient-to-r from-accent to-accentDark px-4 py-2 text-sm font-semibold text-midnight shadow-glow transition hover:brightness-110"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-ocean/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accentDark text-midnight shadow-glow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M7.5 8.5 4 12l3.5 3.5M16.5 8.5 20 12l-3.5 3.5M9.5 16.5 14.5 7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-white">TCC Predictor</p>
            <p className="text-sm text-slate-300">
              Advanced AI-powered platform for detecting, tracking, and predicting the evolution of Tropical Cloud
              Clusters into tropical cyclones.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm text-slate-300 md:grid-cols-3">
          <FooterLinks title="Quick Links" links={['About TCCs', 'Science', 'Algorithms', 'Tools']} />
          <FooterLinks title="Resources" links={['Documentation', 'API Reference', 'Research Papers', 'Contact']} />
          <FooterLinks title="Legal" links={['Privacy Policy', 'Terms of Service']} />
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
        © 2025 TCC Predictor. All rights reserved.
      </div>
    </footer>
  )
}

function FooterLinks({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="space-y-2">
        {links.map((link) => (
          <a key={link} href="#" className="block text-slate-400 transition hover:text-white">
            {link}
          </a>
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <div className="min-h-screen bg-midnight text-slate-100">
        <Header />
        <main className="relative isolate overflow-hidden">
          <div className="absolute inset-0 bg-animated" aria-hidden />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tools" element={<TryTools />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
