import React from 'react'
import {
  View,
  Text } from 'react-native'
import dayjs from 'dayjs'
import calendar from 'dayjs/plugin/calendar'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useChatContext } from '../ChatContext'
import { DATE_FORMAT } from '../Constant'
import { useLabels } from '../hooks/useLabels'
import { useThemedStyles } from '../hooks/useTheme'
import stylesCommon from '../styles'
import { localDayKey } from '../utils'
import { createDayStyles } from './styles'
import { DayProps } from './types'

export * from './types'

dayjs.extend(relativeTime)
dayjs.extend(calendar)

// A separator's label depends only on its day, today, the locale and the format, yet dayjs
// builds, localises and formats two dates for it - a few milliseconds per separator on every
// mount while a chat opens or a list scrolls. The common case (no custom calendar formats) is
// cached by those inputs.
const dayCache = new Map<string, string>()
const DAY_CACHE_MAX = 500

function formatDayLabel (
  createdAt: NonNullable<DayProps['createdAt']>,
  locale: string,
  dateFormat: string,
  todayLabel: string,
  dateFormatCalendar: DayProps['dateFormatCalendar']
) {
  const key = dateFormatCalendar
    ? undefined
    : `${localDayKey(createdAt)}|${localDayKey(Date.now())}|${locale}|${dateFormat}|${todayLabel}`
  const cached = key && dayCache.get(key)
  if (cached)
    return cached

  const now = dayjs().startOf('day')
  const date = dayjs(createdAt).locale(locale).startOf('day')
  const label = !now.isSame(date, 'year')
    ? date.format('D MMMM YYYY')
    : now.diff(date, 'days') < 1
      ? date.calendar(now, { sameDay: `[${todayLabel}]`, ...dateFormatCalendar })
      : date.format(dateFormat)

  if (key) {
    if (dayCache.size >= DAY_CACHE_MAX)
      dayCache.clear()
    dayCache.set(key, label)
  }
  return label
}

export function Day ({
  dateFormat = DATE_FORMAT,
  dateFormatCalendar,
  createdAt,
  containerStyle,
  wrapperStyle,
  textProps,
}: DayProps) {
  const { getLocale } = useChatContext()
  const labels = useLabels()
  const styles = useThemedStyles(createDayStyles)

  const dateStr = createdAt == null
    ? null
    : formatDayLabel(createdAt, getLocale(), dateFormat, labels.today, dateFormatCalendar)

  if (!dateStr)
    return null

  return (
    <View style={[stylesCommon.centerItems, styles.container, containerStyle]}>
      <View style={[styles.wrapper, wrapperStyle]}>
        <Text {...textProps} style={[styles.text, textProps?.style]}>
          {dateStr}
        </Text>
      </View>
    </View>
  )
}
