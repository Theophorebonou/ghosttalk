import { AuthGuard } from '@/components/auth/AuthGuard'

export default function AppLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>
}
