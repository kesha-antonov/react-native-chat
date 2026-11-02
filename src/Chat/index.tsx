import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import '../dayjsLocales'
import { ChatWrapper } from './ChatWrapper'

dayjs.extend(localizedFormat)

export {
  ChatWrapper as Chat
}
