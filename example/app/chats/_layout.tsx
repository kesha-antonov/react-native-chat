import { Stack } from 'expo-router'

// The chat list's screens draw their own header, so the stack shows none.
export default function ChatsLayout () {
  return <Stack screenOptions={{ headerShown: false }} activityEnabled />
}
