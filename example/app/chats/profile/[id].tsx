import { useLocalSearchParams } from 'expo-router'

import ProfileScreen from '@/components/chat-list/ProfileScreen'

/** A chat's profile, opened from its header. */
export default function ProfileRoute () {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProfileScreen key={id} id={id} />
}
