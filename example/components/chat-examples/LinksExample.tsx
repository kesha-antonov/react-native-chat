import React, { useCallback, useMemo, useState } from 'react'
import { Linking, StyleSheet, Text } from 'react-native'
import { ActionSheetProvider, useActionSheet } from '@expo/react-native-action-sheet'
import { Chat, FetchLinkPreview, IMessage, LinkMatcher, LinkPreview } from '@kesha-antonov/react-native-chat'
import { setStringAsync } from 'expo-clipboard'
import { isValidPhoneNumber, parsePhoneNumberWithError } from 'libphonenumber-js'

// A stand-in for a server that reads a page's Open Graph tags; a real app would call its backend
// here (fetching pages straight from the device runs into CORS on web and leaks the user's IP).
const KNOWN_PAGES: Record<string, LinkPreview> = {
  'expo.dev': {
    siteName: 'Expo',
    title: 'Expo',
    description: 'An open-source platform for making universal native apps for Android, iOS, and the web.',
    image: 'https://picsum.photos/seed/expo-og/1200/630',
    imageWidth: 1200,
    imageHeight: 630,
  },
  'reactnative.dev': {
    siteName: 'React Native',
    title: 'React Native · Learn once, write anywhere',
    description: 'A framework for building native applications using React.',
    image: 'https://picsum.photos/seed/rn-og/400/400',
    imageWidth: 400,
    imageHeight: 400,
  },
}

const fetchLinkPreview: FetchLinkPreview = async url => {
  await new Promise(resolve => setTimeout(resolve, 300))
  const host = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  return KNOWN_PAGES[host] ?? null
}

const LinksExample: React.FC = () => {
  const { showActionSheetWithOptions } = useActionSheet()

  const initialMessages: IMessage[] = useMemo(() => [
    {
      text: 'Welcome! 👋',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'This example shows how Chat handles different types of links in messages. Try tapping on any link!',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'Phone numbers are also parsed:\n\n• +79931234567\n\n• 89931234567\n\n• +1-215-456-7890.\n\nIt shouldn\'t parse phone numbers in file names like IMG_20220101_123456.jpg, 89201234567_today.pdf, or in addresses like 1234 React St., JS City, 56789.',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'Email addresses are clickable: cool.guy@example.com or contact@reactnative.dev',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'Different link formats work:\n• www.google.com\n• google.com\n• https://google.com',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'Links get a preview block when the message carries one: https://github.com/kesha-antonov/react-native-chat',
      user: {
        _id: 2,
        name: 'John Doe',
      },
      linkPreview: {
        siteName: 'GitHub',
        title: 'kesha-antonov/react-native-chat',
        description: 'A complete, modern messenger-style chat UI for React Native and Web.',
        image: 'https://picsum.photos/seed/rn-chat-og/1200/600',
        imageWidth: 1200,
        imageHeight: 600,
      },
    },
    {
      text: 'Or when fetchLinkPreview finds one. Send expo.dev or reactnative.dev to try it.',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'Use hashtags to categorize: #chat #reactnative #opensource',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'You can mention people like @kesha-antonov or @john-doe',
      user: {
        _id: 2,
        name: 'John Doe',
      },
    },
    {
      text: 'System message with link: Check out our documentation at https://github.com/kesha-antonov/react-native-chat',
      user: {
        _id: 2,
        name: 'John Doe',
      },
      system: true,
    },
    {
      text: 'System message with data and phone numbers: Contact support at +79931234567 or +1-215-456-7890. We have holidays on 2025-12-25 and until 2026-01-01 12:00.',
      user: {
        _id: 2,
        name: 'John Doe',
      },
      system: true,
    },
  ].map((message, index, all) => ({
    ...message,
    _id: index + 1,
    // Listed in reading order, so the first message is the oldest; Chat wants
    // newest first, hence the reverse below.
    createdAt: new Date(Date.now() - (all.length - 1 - index) * 60000),
  })).reverse(), [])

  const [messages, setMessages] = useState<IMessage[]>(initialMessages)

  const user = useMemo(() => ({
    _id: 1,
    name: 'Developer',
  }), [])

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages(previousMessages => Chat.append(previousMessages, newMessages))
  }, [])

  const getValidPhoneNumber = useCallback((text: string): string | undefined => {
    const cleaned = text.replace(/[\-\(\)\s\.]/g, '')

    // Validate with libphonenumber-js
    try {
      // Try direct validation first
      if (isValidPhoneNumber(cleaned))
        return cleaned

      // Try with RU region for local numbers
      if (isValidPhoneNumber(cleaned, 'RU'))
        return cleaned

      // Try parsing to check validity
      const phoneNumber = parsePhoneNumberWithError(cleaned, 'RU')
      if (phoneNumber && phoneNumber.isValid())
        return cleaned

    } catch (error) {
      console.warn('Invalid phone number:', error)
    }

    return undefined
  }, [])

  const handlePressPhoneNumber = useCallback((url: string) => {
    if (!url)
      return // Skip if validation failed

    const options: {
      title: string
      action?: () => void
    }[] = [
      { title: 'Call', action: () => Linking.openURL(`tel:${url}`) },
      { title: 'Send SMS', action: () => Linking.openURL(`sms:${url}`) },
      { title: 'Copy Phone Number', action: () => setStringAsync(url) },
      { title: 'Cancel' },
    ]

    showActionSheetWithOptions({
      options: options.map(o => o.title),
      cancelButtonIndex: options.length - 1,
    }, (buttonIndex?: number) => {
      if (buttonIndex === undefined)
        return

      const option = options[buttonIndex]
      option.action?.()
    })
  }, [showActionSheetWithOptions])

  const matchers = useMemo<LinkMatcher[]>(() => [
    {
      type: 'phone',
      // Pattern that excludes numbers adjacent to underscores or part of filenames
      pattern: /(?<![A-Za-z0-9_])(?:\+?\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}(?![A-Za-z0-9_]|\.[a-z]{2,4})/gi,
      getLinkUrl: (matchedText: string): string => {
        return getValidPhoneNumber(matchedText) || ''
      },
      getLinkText: (text: string): string => {
        return text
      },
      // The pattern above is deliberately loose - it has to catch the many shapes a
      // phone number is written in. That also means it matches things that merely look
      // like one (ISO dates such as 2025-12-25, house numbers), so libphonenumber-js
      // has the final say: anything it rejects renders as ordinary text rather than as
      // a dead link. Styling it as a disabled link instead would still expose it to
      // screen readers as a link and invite a tap that does nothing.
      renderLink: (text: string, url: string, index: number) => {
        if (!getValidPhoneNumber(text) || !url)
          return <Text key={index}>{text}</Text>

        return (
          <Text
            key={index}
            style={styles.link}
            onPress={() => handlePressPhoneNumber(url)}
          >
            {text}
          </Text>
        )
      },
    },
  ], [getValidPhoneNumber, handlePressPhoneNumber])

  return (
    <Chat
      messages={messages}
      onSend={onSend}
      user={user}
      fetchLinkPreview={fetchLinkPreview}
      messageTextProps={{
        phone: false,
        url: true,
        matchers,
        mention: true,
        hashtag: true,
        mentionUrl: 'https://x.com',
        hashtagUrl: 'https://x.com/hashtag',
      }}
    />
  )
}

const ExampleContainer = () => (
  <ActionSheetProvider>
    <LinksExample />
  </ActionSheetProvider>
)

export default ExampleContainer

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
})
