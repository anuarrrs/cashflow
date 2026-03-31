import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xqvtnjtqbvgtufqpsldk.supabase.co'//import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = 'sb_publishable_8vaTbDoLzDztNL0WsKrmOg_ifdEsw5b' //import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
