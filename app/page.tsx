'use client'

import React, { useState, useEffect, useOptimistic, useTransition } from 'react'
import { supabase, isSupabaseConfigured, type Post } from '@/lib/supabase'

// Sample initial retro posts in case Supabase is waiting for connection or empty
const DEMO_FALLBACK_POSTS: Post[] = [
  {
    id: 'demo-1',
    user_id: 'mark-z',
    body: 'Welcome to the new Facebook Wall! What is on your mind? Leave a note or poke your friends.',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'ed-s',
    body: 'Anyone watching The Dark Knight tonight in IMAX? Let me know!',
    created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
  {
    id: 'demo-3',
    user_id: 'sarah-j',
    body: 'Just added "Viva La Vida" to my profile song playlist 🎵',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
]

function formatFacebookTimestamp(dateString: string) {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'Recently'
  }
}

export default function FacebookWall() {
  const [posts, setPosts] = useState<Post[]>([])
  const [message, setMessage] = useState('')
  const [authorName, setAuthorName] = useState('Friend')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [poked, setPoked] = useState(false)

  const charLimit = 280
  const charsRemaining = charLimit - message.length
  const isPostDisabled = message.trim().length === 0 || charsRemaining < 0 || submitting

  // Fetch initial posts
  const fetchPosts = async () => {
    try {
      setLoading(true)
      if (!isSupabaseConfigured) {
        // Use demo fallback posts if not configured yet
        const stored = typeof window !== 'undefined' ? localStorage.getItem('fb_wall_offline_posts') : null
        if (stored) {
          try {
            setPosts(JSON.parse(stored))
          } catch {
            setPosts(DEMO_FALLBACK_POSTS)
          }
        } else {
          setPosts(DEMO_FALLBACK_POSTS)
        }
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching posts:', error)
        setStatusMessage(`Supabase error: ${error.message}. Showing local cache.`)
        setPosts(DEMO_FALLBACK_POSTS)
      } else if (data) {
        setPosts(data)
      }
    } catch (err: any) {
      console.error('Unexpected error loading posts:', err)
      setPosts(DEMO_FALLBACK_POSTS)
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to Realtime posts
  useEffect(() => {
    fetchPosts()

    if (!isSupabaseConfigured) {
      return
    }

    const channel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const newPost = payload.new as Post
          setPosts((prev) => {
            // Avoid duplicate additions
            if (prev.some((p) => p.id === newPost.id)) {
              return prev
            }
            return [newPost, ...prev]
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeActive(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Handle post submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || trimmed.length > charLimit || submitting) return

    setSubmitting(true)
    setStatusMessage(null)

    if (!isSupabaseConfigured) {
      // In local mode without Supabase keys yet, save locally so tester can evaluate right away
      const newLocalPost: Post = {
        id: 'local-' + Date.now(),
        body: trimmed,
        created_at: new Date().toISOString(),
      }
      const updated = [newLocalPost, ...posts]
      setPosts(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('fb_wall_offline_posts', JSON.stringify(updated))
      }
      setMessage('')
      setSubmitting(false)
      setStatusMessage('Posted locally! To sync with database, configure your Supabase keys.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          body: trimmed,
        })
        .select()

      if (error) {
        console.error('Error inserting post:', error)
        setStatusMessage(`Failed to post: ${error.message}`)
      } else {
        setMessage('')
        // Optimistically ensure post is visible even before realtime ping
        if (data && data[0]) {
          const inserted = data[0] as Post
          setPosts((current) => {
            if (current.some((p) => p.id === inserted.id)) return current
            return [inserted, ...current]
          })
        }
        setStatusMessage('Post published to Wall!')
        setTimeout(() => setStatusMessage(null), 3000)
      }
    } catch (err: any) {
      console.error('Submission failed:', err)
      setStatusMessage(`Submission failed: ${err.message || 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePoke = () => {
    setPoked(true)
    setTimeout(() => setPoked(false), 2500)
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] font-['Lucida_Grande',Tahoma,Verdana,Arial,sans-serif] text-[11px] text-[#333333]">
      {/* 2008 Classic Facebook Blue Header */}
      <header className="bg-[#3b5998] border-b border-[#133783] text-white">
        <div className="max-w-[980px] mx-auto px-4 h-[38px] flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-baseline space-x-1 cursor-pointer">
              <span className="font-bold text-[22px] tracking-tighter lowercase leading-none text-white select-none">
                facebook
              </span>
            </div>

            <nav className="hidden md:flex items-center space-x-3 text-[11px] text-[#d8dfea]">
              <a href="#" className="text-white font-bold hover:underline">Profile</a>
              <span className="text-[#6d84b4]">|</span>
              <a href="#" className="hover:underline">Friends</a>
              <span className="text-[#6d84b4]">|</span>
              <a href="#" className="hover:underline">Networks</a>
              <span className="text-[#6d84b4]">|</span>
              <a href="#" className="hover:underline">Inbox (1)</a>
            </nav>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="hidden sm:inline text-[#d8dfea]">
              Logged in as <strong className="text-white">Mark Zuckerberg</strong>
            </span>
            <div className="relative">
              <input
                type="text"
                placeholder="search"
                className="bg-[#2d4373] text-white placeholder-gray-300 text-[11px] px-2 py-0.5 rounded-sm border border-[#1d2f53] w-28 sm:w-36 focus:outline-none focus:bg-white focus:text-black focus:placeholder-gray-500"
              />
            </div>
            <button className="text-[#d8dfea] hover:underline text-[11px]">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Supabase Status Banner */}
      <div className="bg-[#fff9d7] border-b border-[#e2c822] text-[#333333] px-4 py-1.5 text-center text-[11px]">
        {isSupabaseConfigured ? (
          <span className="inline-flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-green-500 animate-pulse' : 'bg-emerald-600'}`}></span>
            <span>
              Connected to <strong>Supabase</strong> {isRealtimeActive ? '(Realtime updates live ⚡)' : '(Ready)'}
            </span>
          </span>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="font-bold text-[#b45309]">Demo Mode:</span>
            <span>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to activate cloud realtime database.</span>
          </div>
        )}
      </div>

      {/* Main Profile Page Container */}
      <main className="max-w-[980px] mx-auto px-2 sm:px-4 py-4">
        {/* Profile Header Bar */}
        <div className="bg-[#eceff5] border border-[#d8dfea] p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-sm">
          <div className="flex items-center space-x-3">
            <div className="w-[50px] h-[50px] bg-[#3b5998] border border-[#133783] flex items-center justify-center text-white text-[24px] font-bold shadow-sm">
              MZ
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-[16px] font-bold text-[#333333] leading-tight">
                  Mark Zuckerberg
                </h1>
                <span className="text-[10px] bg-[#d8dfea] text-[#3b5998] px-1.5 py-0.5 rounded font-semibold">
                  Founder
                </span>
              </div>
              <p className="text-[#666666] text-[11px] mt-0.5">
                &quot;is working on making the world more open and connected.&quot; &bull;{' '}
                <span className="text-[#3b5998] cursor-pointer hover:underline">Updated 2 hours ago</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={handlePoke}
              className="fb-button-secondary text-[11px] font-bold"
            >
              {poked ? '👉 You poked Mark!' : '👉 Poke'}
            </button>
            <button
              onClick={() => alert("Message popup: Mark's inbox is currently open on The Wall.")}
              className="fb-button-secondary text-[11px] font-bold"
            >
              ✉ Send Message
            </button>
          </div>
        </div>

        {/* 2-Column 2008 Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Sidebar (Classic 2008 Info / Friends box) */}
          <aside className="md:col-span-4 space-y-4">
            {/* Profile Picture Box */}
            <div className="bg-white border border-[#d8dfea] p-3 shadow-xs">
              <div className="w-full aspect-[4/5] bg-[#3b5998]/10 border border-[#d8dfea] flex flex-col items-center justify-center text-center p-4">
                <div className="w-24 h-24 rounded-full bg-[#3b5998] flex items-center justify-center text-white text-3xl font-bold mb-2 shadow-inner">
                  MZ
                </div>
                <span className="font-bold text-[12px] text-[#3b5998]">Mark Zuckerberg</span>
                <span className="text-[10px] text-[#666666]">Harvard / Palo Alto, CA</span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-[#eceff5] text-[10px] text-[#3b5998] space-y-1">
                <div><a href="#" className="hover:underline">View Photos of Mark (142)</a></div>
                <div><a href="#" className="hover:underline">View Mark&apos;s Friends (845)</a></div>
                <div><a href="#" className="hover:underline">Subscribe to Mark&apos;s Feed</a></div>
              </div>
            </div>

            {/* Information Box */}
            <div className="bg-white border border-[#d8dfea] p-3 shadow-xs">
              <div className="border-b border-[#eceff5] pb-1.5 mb-2 font-bold text-[#3b5998] text-[12px] flex justify-between items-center">
                <span>Information</span>
                <a href="#" className="text-[10px] text-[#3b5998] font-normal hover:underline">Edit</a>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="text-[#777777] inline-block w-20">Networks:</span>
                  <span className="font-semibold text-[#3b5998]">Harvard Alumni</span>
                </div>
                <div>
                  <span className="text-[#777777] inline-block w-20">Relationship:</span>
                  <span>In a relationship</span>
                </div>
                <div>
                  <span className="text-[#777777] inline-block w-20">Birthday:</span>
                  <span>May 14, 1984</span>
                </div>
                <div>
                  <span className="text-[#777777] inline-block w-20">Current City:</span>
                  <span>Palo Alto, CA</span>
                </div>
              </div>
            </div>

            {/* Mini Mutual Friends widget */}
            <div className="bg-white border border-[#d8dfea] p-3 shadow-xs">
              <div className="border-b border-[#eceff5] pb-1.5 mb-2 font-bold text-[#3b5998] text-[12px] flex justify-between items-center">
                <span>Friends in Common</span>
                <span className="text-[10px] text-[#666666] font-normal">6 friends</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                {['Dustin', 'Eduardo', 'Chris', 'Sean', 'Andrew', 'Naomi'].map((name) => (
                  <div key={name} className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-[#eceff5] border border-[#cad1d9] flex items-center justify-center font-bold text-[#3b5998]">
                      {name[0]}
                    </div>
                    <span className="text-[#3b5998] truncate w-full mt-1 hover:underline cursor-pointer">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Column: Wall Tabs, Publisher, and Feed */}
          <section className="md:col-span-8 space-y-3">
            {/* Tabs Header */}
            <div className="flex border-b border-[#d8dfea] space-x-1 pt-1 select-none">
              <div className="fb-tab-active px-4 py-1.5 text-[12px] -mb-[1px] cursor-pointer">
                Wall
              </div>
              <div className="fb-tab-inactive px-4 py-1.5 text-[12px] -mb-[1px] hover:bg-[#e9edf4] cursor-pointer">
                Info
              </div>
              <div className="fb-tab-inactive px-4 py-1.5 text-[12px] -mb-[1px] hover:bg-[#e9edf4] cursor-pointer">
                Photos
              </div>
              <div className="fb-tab-inactive px-4 py-1.5 text-[12px] -mb-[1px] hover:bg-[#e9edf4] cursor-pointer">
                Boxes
              </div>
            </div>

            {/* Notification alert if any */}
            {statusMessage && (
              <div className="p-2 bg-[#fff9d7] border border-[#e2c822] text-[#333333] rounded-xs text-[11px]">
                {statusMessage}
              </div>
            )}

            {/* The Wall Publisher Box */}
            <div className="bg-white border border-[#b3c2d8] rounded-xs shadow-xs">
              <div className="bg-[#eceff5] px-3 py-1.5 border-b border-[#d8dfea] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#3b5998] text-[11px]">Write on Mark&apos;s Wall</span>
                </div>
                <span className="text-[10px] text-[#666666]">
                  Max 280 characters
                </span>
              </div>

              <form onSubmit={handleSubmit} className="p-3">
                <div className="relative">
                  <textarea
                    id="wall-post-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write something to Mark..."
                    rows={3}
                    maxLength={280}
                    disabled={submitting}
                    className="w-full p-2 border border-[#bdc7d8] text-[12px] focus:outline-none focus:border-[#3b5998] resize-y placeholder-gray-400 font-sans"
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#eceff5]">
                  {/* Character Counter */}
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span
                      className={`font-semibold ${
                        charsRemaining < 0
                          ? 'text-red-600 font-bold'
                          : charsRemaining <= 20
                          ? 'text-amber-600 font-bold'
                          : 'text-[#777777]'
                      }`}
                    >
                      {charsRemaining} characters left
                    </span>
                  </div>

                  {/* Share Button (2008 Style) */}
                  <div className="flex items-center space-x-2">
                    {message.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMessage('')}
                        disabled={submitting}
                        className="fb-button-secondary text-[11px]"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isPostDisabled}
                      className="fb-button-primary"
                    >
                      {submitting ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Feed Filter / Controls */}
            <div className="flex items-center justify-between px-1 py-1 text-[11px] text-[#666666] border-b border-[#d8dfea]">
              <span className="font-bold text-[#3b5998]">
                Displaying {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchPosts}
                  className="text-[#3b5998] hover:underline flex items-center space-x-1"
                  title="Reload feed"
                >
                  <span>🔄 Refresh</span>
                </button>
                <span className="text-[#cccccc]">|</span>
                <span className="text-[#777777]">Newest First</span>
              </div>
            </div>

            {/* Posts Feed Component */}
            <div className="space-y-3 pt-1">
              {loading && posts.length === 0 ? (
                <div className="bg-white p-8 text-center border border-[#d8dfea] text-[#777777]">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#3b5998] border-t-transparent mb-2"></div>
                  <p>Loading Wall posts...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white p-8 text-center border border-[#d8dfea] text-[#777777]">
                  <p className="font-semibold text-[13px] text-[#333333] mb-1">No posts on Mark&apos;s Wall yet.</p>
                  <p>Be the first friend to leave a message above!</p>
                </div>
              ) : (
                posts.map((post, idx) => (
                  <article
                    key={post.id || idx}
                    className="bg-white border border-[#d8dfea] p-3 rounded-xs shadow-2xs hover:border-[#b3c2d8] transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="w-[40px] h-[40px] bg-[#eceff5] border border-[#cad1d9] flex items-center justify-center font-bold text-[#3b5998] text-[14px] shrink-0">
                        {post.user_id ? post.user_id.slice(0, 2).toUpperCase() : '👤'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-1 mb-1">
                          <div>
                            <span className="font-bold text-[#3b5998] hover:underline cursor-pointer text-[12px]">
                              {post.user_id ? `User ${post.user_id.slice(0, 6)}` : 'Friend'}
                            </span>
                            <span className="text-[#777777] mx-1">▶</span>
                            <span className="font-bold text-[#3b5998] hover:underline cursor-pointer text-[12px]">
                              Mark Zuckerberg
                            </span>
                          </div>
                          <time className="text-[10px] text-[#808080]" dateTime={post.created_at}>
                            {formatFacebookTimestamp(post.created_at)}
                          </time>
                        </div>

                        {/* Post Body */}
                        <p className="text-[12px] text-[#333333] leading-relaxed break-words whitespace-pre-wrap font-sans">
                          {post.body}
                        </p>

                        {/* 2008 Action Links */}
                        <div className="mt-2 pt-2 border-t border-[#f2f2f2] flex items-center space-x-3 text-[10px] text-[#3b5998]">
                          <button
                            onClick={() => alert('Wall post liked!')}
                            className="hover:underline font-medium flex items-center space-x-1"
                          >
                            <span>👍 Like</span>
                          </button>
                          <span className="text-[#d8dfea]">&bull;</span>
                          <button
                            onClick={() => {
                              const input = document.getElementById('wall-post-input')
                              input?.focus()
                            }}
                            className="hover:underline font-medium"
                          >
                            Comment
                          </button>
                          <span className="text-[#d8dfea]">&bull;</span>
                          <span className="text-[#888888]">Report</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        {/* 2008 Classic Footer */}
        <footer className="mt-8 pt-4 border-t border-[#d8dfea] text-center text-[10px] text-[#808080] space-y-1 pb-8">
          <div className="space-x-3 text-[#3b5998]">
            <a href="#" className="hover:underline">About</a>
            <a href="#" className="hover:underline">Advertising</a>
            <a href="#" className="hover:underline">Developers</a>
            <a href="#" className="hover:underline">Careers</a>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <a href="#" className="hover:underline">Help</a>
          </div>
          <div>Facebook &copy; 2008 &bull; Built with React 19, Next.js, and Supabase Realtime</div>
        </footer>
      </main>
    </div>
  )
}
