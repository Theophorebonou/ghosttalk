import { GhostBackdrop } from '@/components/visual/GhostBackdrop'

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <GhostBackdrop variant="auth" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
