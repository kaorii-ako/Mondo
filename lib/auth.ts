import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase-admin'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
        name:     { label: 'Name',     type: 'text' },
        mode:     { label: 'Mode',     type: 'text' }, // 'login' | 'signup'
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (credentials.mode !== 'login' && credentials.mode !== 'signup') return null

        if (credentials.mode === 'signup') {
          const { data: existing } = await supabaseAdmin
            .from('users').select('id').eq('email', credentials.email).maybeSingle()
          if (existing) throw new Error('Email already registered')

          const hash = await bcrypt.hash(credentials.password, 12)
          const { data: user, error } = await supabaseAdmin
            .from('users')
            .insert({ email: credentials.email, name: credentials.name || null, password_hash: hash })
            .select('id, email, name, tier').single()
          if (error || !user) throw new Error('Signup failed')
          return { id: user.id, email: user.email, name: user.name, tier: user.tier }
        }

        const { data: user } = await supabaseAdmin
          .from('users').select('id, email, name, tier, password_hash')
          .eq('email', credentials.email).single()
        if (!user?.password_hash) throw new Error('Invalid credentials')

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) throw new Error('Invalid credentials')
        return { id: user.id, email: user.email, name: user.name, tier: user.tier }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId:     process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await supabaseAdmin.from('users').upsert(
          { email: user.email!, name: user.name ?? null },
          { onConflict: 'email', ignoreDuplicates: false }
        )
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) { token.id = user.id; token.tier = (user as any).tier ?? 'free' }
      if (account?.provider === 'google' && token.email && !token.tier) {
        const { data } = await supabaseAdmin
          .from('users').select('id, tier').eq('email', token.email).single()
        if (data) { token.id = data.id; token.tier = data.tier }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id   = token.id
      session.user.tier = token.tier
      return session
    },
  },
  pages: { signIn: '/auth/login', error: '/auth/login' },
  session: { strategy: 'jwt' },
}
