import { useLocalSearchParams } from 'expo-router'

import ChatScreen from '@/components/chat-list/ChatScreen'

export default function ChatRoute () {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ChatScreen key={id} id={id} />
}
