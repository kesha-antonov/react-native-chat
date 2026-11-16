import React, { useCallback, useState } from 'react'
import { Chat, IMessage, ReactionIconProps } from '@kesha-antonov/react-native-chat'
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark'
import Flame from 'lucide-react-native/icons/flame'
import Heart from 'lucide-react-native/icons/heart'
import Lightbulb from 'lucide-react-native/icons/lightbulb'
import ThumbsUp from 'lucide-react-native/icons/thumbs-up'

import { useAppearance } from '@/components/appearance'
import { useDemoSend } from './useDemoSend'

const USER = { _id: 1, name: 'You' }
const BOT = { _id: 2, name: 'Bot' }

// Reactions are plain keys of your own; the icon set draws them.
const ICONS = {
  like: ThumbsUp,
  love: Heart,
  fire: Flame,
  idea: Lightbulb,
  question: CircleQuestionMark,
}
const REACTION_KEYS = Object.keys(ICONS)

// One renderer for the pills, the reactions bar and the pick flying between them. Your own
// reaction is drawn filled.
const renderReactionIcon = ({ emoji, size, color, isChosen }: ReactionIconProps) => {
  const Icon = ICONS[emoji as keyof typeof ICONS]
  if (!Icon)
    return null

  return <Icon size={size} color={color} fill={isChosen ? color : 'none'} fillOpacity={isChosen ? 0.25 : 0} />
}

const INITIAL_MESSAGES: IMessage[] = [
  {
    _id: 2,
    text: 'These reactions are icons, not emoji: long-press me for the bar, or tap a pill.',
    createdAt: new Date(Date.now() - 1000 * 30),
    user: BOT,
    reactions: [{ emoji: 'idea', userIds: [1, 2] }, { emoji: 'question', userIds: [2] }],
  },
  {
    _id: 1,
    text: 'A key without an icon keeps its emoji text.',
    createdAt: new Date(Date.now() - 1000 * 60),
    user: BOT,
    reactions: [{ emoji: '🎉', userIds: [2] }],
  },
]

export default function ReactionIconsExample () {
  const appearance = useAppearance()
  const [messages, setMessages] = useState<IMessage[]>(INITIAL_MESSAGES)

  const onSend = useDemoSend(setMessages)

  const onReactionPress = useCallback((message: IMessage, key: string) => {
    setMessages(previous => Chat.toggleReaction(previous, message._id, key, USER._id))
  }, [])

  return (
    <Chat
      appearance={appearance}
      messages={messages}
      onSend={onSend}
      user={USER}
      // No emoji grid behind the chevron: only the keys above.
      reactions={{ onReactionPress, emojis: REACTION_KEYS, renderReactionIcon, renderExpandedPicker: null }}
    />
  )
}
