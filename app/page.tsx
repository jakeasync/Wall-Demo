'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured, type Post } from '@/lib/supabase'

const INITIAL_MOCK_POSTS: Post[] = [
  {
    id: 'mock-1',
    author_name: 'Jake Macua',
    body: 'It worked!',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    author_name: 'Jake Macua',
    body: 'Hello world! This is a live website.',
    created_at: new Date(Date.now() - 1000 * 60).toISOString(),
  },
  {
    id: 'mock-3',
    author_name: 'Anna',
    body: 'Hey Jake, did you debug your coffee maker yet? Last cup tasted like JavaScript errors.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'mock-4',
    author_name: 'Adelaida',
    body: 'Jake, saw your last coding session—pretty sure you broke Stack Overflow again! 🧯',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'mock-5',
    author_name: 'Juho',
    body: 'Jake, are you still coding in pajamas, or have you upgraded to full-time sweatpants mode?',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'mock-6',
    author_name: 'Maija',
    body: 'Jake, rumor has it your computer has more stickers than code running on it. Confirm?',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'mock-7',
    author_name: 'Alex',
    body: 'Yo Jake, just pulled an all-nighter on the assignment. Turns out sleep deprivation doesn\'t improve coding skills. Weird!',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: 'mock-8',
    author_name: 'Sheryl',
    body: 'Jake, when are we gonna deploy your latest dance moves to production? #AgileDancer',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
]

function formatRelativeTime(dateString: string) {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 2) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}d`
  } catch {
    return 'now'
  }
}

export default function WallPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [message, setMessage] = useState('')
  const [authorName, setAuthorName] = useState('Jake Macua')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>('/avatar.svg')

  // Load custom profile photo from localStorage if user uploaded one previously
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPhoto = localStorage.getItem('wall_custom_profile_photo')
        if (savedPhoto && savedPhoto.length > 50) {
          setProfilePhotoUrl(savedPhoto)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Please choose an image under 8MB')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        setProfilePhotoUrl(result)
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('wall_custom_profile_photo', result)
          }
        } catch (err) {
          console.warn('Storage quota exceeded, photo will remain in memory for this session:', err)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const charLimit = 280
  const charsRemaining = charLimit - message.length
  const isPostDisabled =
    (!message.trim() && !selectedFile) || charsRemaining < 0 || submitting || uploadingImage

  // Load posts on mount (from Supabase or localStorage / fallback)
  useEffect(() => {
    async function loadPosts() {
      // Clear out any old cached 'Greg' posts from localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('wall_posts_data')
        if (stored && stored.includes('Greg')) {
          localStorage.removeItem('wall_posts_data')
        }
      }

      if (!isSupabaseConfigured) {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('wall_posts_data')
          if (stored) {
            try {
              setPosts(JSON.parse(stored))
              return
            } catch {
              // fallback below
            }
          }
        }
        setPosts(INITIAL_MOCK_POSTS)
        return
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        setPosts(data)
      } else {
        // If Supabase table is empty or error, show default mock posts
        setPosts(INITIAL_MOCK_POSTS)
      }
    }

    loadPosts()

    // Realtime subscription if Supabase configured
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:posts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts' },
          (payload) => {
            const newPost = payload.new as Post
            setPosts((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev
              return [newPost, ...prev]
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Failed to upload photo. File must be under 5MB.')
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setErrorMessage(null)
    }
  }

  const handleClearPhoto = () => {
    setSelectedFile(null)
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isPostDisabled) return

    setSubmitting(true)
    setErrorMessage(null)

    let uploadedImageUrl: string | null = null

    // Photo upload handling
    if (selectedFile) {
      if (isSupabaseConfigured) {
        try {
          setUploadingImage(true)
          const fileExt = selectedFile.name.split('.').pop() || 'jpg'
          const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('wall-photos')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            console.error('Storage upload error:', uploadError)
            setErrorMessage('Failed to upload photo. Please try again. (Ensure "wall-photos" bucket is created and public in Supabase).')
            setSubmitting(false)
            setUploadingImage(false)
            return
          }

          const { data: publicUrlData } = supabase.storage
            .from('wall-photos')
            .getPublicUrl(filePath)

          uploadedImageUrl = publicUrlData?.publicUrl || null
        } catch (err) {
          console.error(err)
          setErrorMessage('Failed to upload photo. Please try again.')
          setSubmitting(false)
          setUploadingImage(false)
          return
        } finally {
          setUploadingImage(false)
        }
      } else {
        // In local browser mode, convert to base64 so it can be viewed and stored
        try {
          uploadedImageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(selectedFile)
          })
        } catch {
          uploadedImageUrl = previewUrl
        }
      }
    }

    const currentAuthor = authorName.trim() || 'Jake Macua'

    if (isSupabaseConfigured) {
      // Build payload matching columns: body, photo_url / image_url, and author_name
      const postPayload: Record<string, any> = {
        body: message.trim(),
        author_name: 'Jake Macua',
      }
      if (uploadedImageUrl) {
        postPayload.photo_url = uploadedImageUrl
        postPayload.image_url = uploadedImageUrl
      }

      let { data, error } = await supabase
        .from('posts')
        .insert([postPayload])
        .select()
        .single()

      // If user table didn't have author_name column, retry without it
      if (error && error.message.includes('author_name')) {
        const noAuthorPayload: Record<string, any> = {
          body: message.trim(),
        }
        if (uploadedImageUrl) {
          noAuthorPayload.photo_url = uploadedImageUrl
          noAuthorPayload.image_url = uploadedImageUrl
        }
        const retry = await supabase.from('posts').insert([noAuthorPayload]).select().single()
        data = retry.data
        error = retry.error
      }

      // If user altered schema to use photo_url instead of image_url, try fallback
      if (error && error.message.includes('image_url') && uploadedImageUrl) {
        const fallbackPayload = {
          body: message.trim(),
          photo_url: uploadedImageUrl,
          author_name: 'Jake Macua',
        }
          photo_url: uploadedImageUrl,
        }
        const retry = await supabase.from('posts').insert([fallbackPayload]).select().single()
        data = retry.data
        error = retry.error
      }

      if (error) {
        console.error('Supabase insert error:', error)
        setErrorMessage(`Error publishing post: ${error.message}`)
        setSubmitting(false)
        return
      }

      if (data) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev
          return [data as Post, ...prev]
        })
      }
    } else {
      // Local browser storage
      const localPost: Post = {
        id: 'local-' + Date.now(),
        author_name: currentAuthor,
        body: message.trim(),
        image_url: uploadedImageUrl,
        created_at: new Date().toISOString(),
      }
      const updated = [localPost, ...posts]
      setPosts(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('wall_posts_data', JSON.stringify(updated))
      }
    }

    setMessage('')
    handleClearPhoto()
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-white text-[#111111] font-sans antialiased">
      {/* Top Bar - Clean Blue Banner matching mockup */}
      <header className="w-full bg-[#3b82f6] px-6 py-2.5 shadow-sm">
        <h1 className="text-white font-bold text-[18px] tracking-tight">wall</h1>
      </header>

      {/* Main Content Area */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Big Profile Photo & User Info */}
          <aside className="md:col-span-3 space-y-4">
            {/* Hidden file input for replacing profile photo */}
            <input
              type="file"
              ref={profilePhotoInputRef}
              onChange={handleProfilePhotoSelect}
              accept="image/*"
              className="hidden"
              id="profile-photo-upload"
            />

            {/* Big Profile Photo matching mockup - Clickable to replace */}
            <div
              onClick={() => profilePhotoInputRef.current?.click()}
              title="Click to change profile photo"
              className="w-full aspect-[4/5] rounded-lg overflow-hidden shadow-sm border border-gray-200 bg-gray-100 relative group cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profilePhotoUrl}
                alt="Profile picture"
                className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-102"
                onError={(e) => {
                  const target = e.currentTarget
                  target.src = '/avatar.svg'
                }}
              />
              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold p-2 text-center">
                <span className="text-lg mb-1">📷</span>
                <span>Click to change photo</span>
              </div>
            </div>

            {/* Profile Name & Subtitle */}
            <div className="pt-1">
              <h2 className="text-[20px] font-bold text-gray-900 leading-snug">
                Jake Macua
              </h2>
              <p className="text-[14px] text-gray-600 mt-0.5">wall</p>
            </div>

            {/* Information Button */}
            <div>
              <button
                type="button"
                className="px-3.5 py-1.5 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-gray-800 text-[13px] font-normal rounded-md border border-gray-200 transition-colors shadow-2xs"
              >
                Information
              </button>
            </div>

            {/* Networks & Current City */}
            <div className="space-y-3 pt-2 text-[13px]">
              <div>
                <p className="font-bold text-gray-800">Networks</p>
                <p className="text-gray-600 mt-0.5">STI Alum</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">Current City</p>
                <p className="text-gray-600 mt-0.5">Legazpi City</p>
              </div>
            </div>
          </aside>

          {/* Right Column: Wall Composer & Posts Feed */}
          <main className="md:col-span-9 space-y-6">
            {/* Wall Input Composer */}
            <form onSubmit={handleShare} className="space-y-2.5">
              {/* Text input box immediately above the Share button */}
              <div className="relative rounded-lg border border-dashed border-blue-200 bg-gradient-to-r from-blue-50/40 via-white to-blue-50/20 p-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  maxLength={charLimit}
                  className="w-full bg-transparent text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none font-sans"
                />

                {/* Optional Attached Photo Preview */}
                {previewUrl && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Upload preview"
                        className="w-14 h-14 object-cover rounded border border-gray-200"
                      />
                      <span className="text-xs text-gray-600 truncate max-w-[200px]">
                        {selectedFile?.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Character remaining and Posting Controls */}
              <div className="flex items-center justify-between text-[12px] text-gray-500">
                <div className="flex items-center space-x-3">
                  <span>{charsRemaining} characters remaining</span>
                  <span>•</span>
                  {/* Optional Photo Attachment */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    id="wall-image-upload"
                  />
                  <label
                    htmlFor="wall-image-upload"
                    className="cursor-pointer text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    📷 Add photo
                  </label>
                </div>

                {/* Share Button (immediately below text input box) */}
                <button
                  type="submit"
                  disabled={isPostDisabled}
                  className={`px-5 py-1.5 rounded text-[13px] font-semibold transition-all shadow-xs ${
                    isPostDisabled
                      ? 'bg-[#e5e7eb] text-white cursor-not-allowed'
                      : 'bg-[#3b82f6] text-white hover:bg-blue-600 cursor-pointer'
                  }`}
                >
                  {submitting || uploadingImage ? 'Sharing...' : 'Share'}
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {errorMessage}
                </div>
              )}
            </form>

            {/* Posts Feed - matching screenshot typography and dividers */}
            <div className="divide-y divide-gray-200 pt-2">
              {posts.map((post) => {
                // If post has no author_name or has previous default 'Greg Wientjes', display Jake Macua
                const rawName = post.author_name || (post.user_id ? post.user_id : '')
                const displayName = (!rawName || rawName === 'Greg Wientjes' || rawName === 'Friend')
                  ? 'Jake Macua'
                  : rawName
                return (
                  <div key={post.id} className="py-4 first:pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[14px] text-gray-900 leading-tight">
                        {displayName}
                      </h3>
                      <span className="text-[12px] text-gray-500">
                        {formatRelativeTime(post.created_at)}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-800 mt-1.5 leading-relaxed whitespace-pre-wrap">
                      {post.body}
                    </p>
                    {/* Photo attachment (supports both photo_url and image_url) */}
                    {(post.photo_url || post.image_url) && (
                      <div className="mt-2.5 max-w-sm rounded-md overflow-hidden border border-gray-200 shadow-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={(post.photo_url || post.image_url)!}
                          alt="Wall attachment"
                          className="w-full max-h-72 object-cover"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
