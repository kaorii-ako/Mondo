import 'next-auth'
import { Tier } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      tier: Tier
    }
  }
  interface User {
    tier: Tier
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    tier: Tier
  }
}
