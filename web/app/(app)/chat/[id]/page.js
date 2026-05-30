import { use } from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function ConversationPage({ params }) {
  // Use React.use to unwrap Next.js params in modern Next.js templates
  const resolvedParams = use(params)
  
  return <ChatWindow conversationId={resolvedParams.id} />
}
