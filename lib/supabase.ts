import { createClient } from '@supabase/supabase-js'

export interface Post {
  id: string
  user_id?: string | null
  body: string
  photo_url?: string | null
  image_url?: string | null
  author_name?: string | null
  created_at: string
}

// Directly connect to Jake's confirmed Supabase project
const supabaseUrl = 'https://secyvabajzyprkyyycpl.supabase.co'
const supabaseAnonKey = 'sb_publishable__lj4pY0-GlUfHNR6TPtKsQ_SbaZAGsT'

export const isSupabaseConfigured = true

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

