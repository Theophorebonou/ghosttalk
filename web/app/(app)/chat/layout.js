import { Sidebar } from '@/components/chat/Sidebar'
import { GhostBackdrop } from '@/components/visual/GhostBackdrop'

export default function ChatLayout({ children }) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background text-zinc-100">
      <GhostBackdrop variant="chat" />
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
