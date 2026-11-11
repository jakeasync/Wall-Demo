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

// Supabase Configuration
// Supports both Vercel Supabase integration variables and standard NEXT_PUBLIC_ variables
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://secyvabajzyprkyyycpl.supabase.co'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable__lj4pY0-GlUfHNR6TPtKsQ_SbaZAGsT'

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_project_url' &&
  supabaseAnonKey !== 'your_anon_key' &&
  !supabaseUrl.includes('placeholder')
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

