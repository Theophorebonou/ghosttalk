'use client'

import { useParams } from 'next/navigation'
import { Sidebar } from '@/components/chat/Sidebar'

export default function ChatLayout({ children }) {
  const params = useParams()
  const activeId = params?.id

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className={`relative z-10 flex min-w-0 flex-1 flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
        {children}
      </main>
    </div>
  )
}
