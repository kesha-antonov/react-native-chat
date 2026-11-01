import React from 'react'

import { ExpandedReactionPickerProps } from '../Reactions/types'
import { EmojiGrid } from './EmojiGrid'

// `SelectAnimatedEmojiDialog.SPAN_COUNT_FOR_EMOJI`.
const COLUMNS = 8

/** The reactions bar's expanded panel by default: the built-in emoji grid, 8 columns. */
export const renderDefaultExpandedPicker = ({ onSelect }: ExpandedReactionPickerProps) => (
  <EmojiGrid variant='reactions' columns={COLUMNS} onSelect={onSelect} />
)
