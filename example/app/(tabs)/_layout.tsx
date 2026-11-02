import React from 'react'
import { NativeTabs } from 'expo-router/native-tabs'

import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

/**
 * The platform's own tab bar (UITabBarController / BottomNavigationView): Liquid Glass on iOS 26+,
 * Material on Android, and no JS on a tab switch. Hidden tabs keep their state but stop rendering
 * (`activityEnabled`), so the chat list does no work while another tab is in front.
 */
export default function TabLayout () {
  const colorScheme = useColorScheme()

  return (
    <NativeTabs tintColor={Colors[colorScheme].tint} activityEnabled>
      <NativeTabs.Trigger name='index'>
        <NativeTabs.Trigger.Icon sf='house.fill' md='home' />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name='explore'>
        <NativeTabs.Trigger.Icon sf='paperplane.fill' md='send' />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name='chats'>
        <NativeTabs.Trigger.Icon sf='bubble.left.and.bubble.right.fill' md='forum' />
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
