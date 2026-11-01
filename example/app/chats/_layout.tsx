import { Stack } from 'expo-router'

// The chat list's screens draw Telegram's own header, so the stack shows none.
export default function ChatsLayout () {
  return <Stack screenOptions={{ headerShown: false }} />
}
