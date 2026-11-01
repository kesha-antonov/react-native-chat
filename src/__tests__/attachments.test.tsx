import React from 'react'
import { Linking, View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { Chat, IMessage, MessageFile, buildAttachmentMessages, formatFileSize, getAttachmentTabs } from '..'
import { resolveAttachmentMessages } from '../attachments/buildMessages'
import { fileExtension } from '../MessageFile'
import { resetOptionalModules } from '../optional'

const mockGetDocumentAsync = jest.fn()
const mockShareAsync = jest.fn(() => Promise.resolve())
const mockCurrentPosition = jest.fn()

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}), { virtual: true })
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  Accuracy: { Balanced: 3 },
}), { virtual: true })
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...(args as [])),
}), { virtual: true })

// The paperclip is a gesture-handler BaseButton, which `fireEvent.press` cannot drive.
jest.mock('../components/TouchableOpacity', () => {
  const { Pressable } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    TouchableOpacity: ({ children, ...rest }: { children: React.ReactNode }) => createElement(Pressable, rest, children),
  }
})

const ME = { _id: 1, name: 'Me' }
const PDF = { uri: 'file:///tmp/report.pdf', name: 'Quarterly report.pdf', size: 13264, mimeType: 'application/pdf' }

beforeEach(() => {
  resetOptionalModules()
})

describe('attachment messages', () => {
  it('builds one message per pick, newest first, with the caption on the first pick', () => {
    const messages = buildAttachmentMessages([
      { type: 'image', uri: 'file:///a.jpg' },
      { type: 'video', uri: 'file:///b.mov', duration: 4 },
      { type: 'file', ...PDF },
      { type: 'location', latitude: 51.5, longitude: -0.12 },
    ], '  Look  ')

    expect(messages).toEqual([
      { text: '', location: { latitude: 51.5, longitude: -0.12 } },
      { text: '', file: PDF },
      { text: '', video: 'file:///b.mov', duration: 4 },
      { text: 'Look', image: 'file:///a.jpg' },
    ])
  })

  it('lets onPick replace the messages, send none, or fall back to the default', async () => {
    const picks = [{ type: 'image' as const, uri: 'file:///a.jpg' }]

    const uploaded = await resolveAttachmentMessages(picks, '', () => [{ text: '', image: 'https://cdn/a.jpg' }])
    expect(uploaded).toEqual([{ text: '', image: 'https://cdn/a.jpg' }])

    expect(await resolveAttachmentMessages(picks, '', () => null)).toEqual([])
    expect(await resolveAttachmentMessages(picks, 'hi', async () => undefined)).toEqual([{ text: 'hi', image: 'file:///a.jpg' }])
  })

  it('offers only the tabs whose peer is installed', () => {
    // Neither expo-media-library nor expo-image-picker is installed here.
    expect(getAttachmentTabs()).toEqual(['file', 'location'])
    expect(getAttachmentTabs(['location', 'file'])).toEqual(['location', 'file'])
  })
})

describe('the paperclip', () => {
  const messages: IMessage[] = [{ _id: 1, text: 'hi', createdAt: 0, user: { _id: 2, name: 'Bot' } }]
  const mountChat = async (ui: React.ReactElement) => {
    jest
      .spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
      .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, 0)) as never)
    const utils = await render(ui)
    await fireEvent(utils.getByTestId('GC_WRAPPER'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    })
    return utils
  }

  it('opens the attachment menu by default, and File sends a file message', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ ...PDF }] })
    const onSend = jest.fn()
    const utils = await mountChat(<Chat messages={messages} onSend={onSend} user={ME} />)

    await fireEvent.press(utils.getByLabelText('Attach'))
    expect(utils.queryByLabelText('Gallery')).toBeNull()
    expect(utils.getByLabelText('Location')).toBeTruthy()

    await fireEvent.press(utils.getByLabelText('File'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockGetDocumentAsync).toHaveBeenCalledWith({ multiple: true, copyToCacheDirectory: true })
    expect(onSend).toHaveBeenCalledTimes(1)
    const [[sent]] = onSend.mock.calls
    expect(sent[0]).toMatchObject({ file: PDF, user: ME })
  })

  // The picker opens over the sheet. Closing the sheet first raced its Modal's dismissal on
  // iOS, so the picker never appeared and File just closed the sheet.
  it('opens the file picker while the sheet is still up, and keeps the sheet on cancel', async () => {
    let isSheetUpWhenPicking = false
    const onSend = jest.fn()
    const utils = await mountChat(<Chat messages={messages} onSend={onSend} user={ME} />)
    mockGetDocumentAsync.mockImplementation(async () => {
      isSheetUpWhenPicking = utils.queryByLabelText('Location') != null
      return { canceled: true, assets: null }
    })

    await fireEvent.press(utils.getByLabelText('Attach'))
    await fireEvent.press(utils.getByLabelText('File'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isSheetUpWhenPicking).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
    expect(utils.getByLabelText('Location')).toBeTruthy()
  })

  it('sends the current location from the Location tab', async () => {
    mockCurrentPosition.mockResolvedValue({ coords: { latitude: 51.5, longitude: -0.12, accuracy: 12 } })
    const onSend = jest.fn()
    const utils = await mountChat(<Chat messages={messages} onSend={onSend} user={ME} />)

    await fireEvent.press(utils.getByLabelText('Attach'))
    await fireEvent.press(utils.getByLabelText('Location'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(utils.getByText('Accurate to 12 m')).toBeTruthy()

    await fireEvent.press(utils.getByLabelText('Send My Current Location'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(onSend.mock.calls[0][0][0]).toMatchObject({ location: { latitude: 51.5, longitude: -0.12 } })
  })

  it('hides with attachments={false}, and legacy actions still win', async () => {
    const hidden = await mountChat(<Chat messages={messages} onSend={() => {}} user={ME} attachments={false} />)
    expect(hidden.queryByLabelText('Attach')).toBeNull()
    await hidden.unmount()

    const action = jest.fn()
    const legacy = await mountChat(<Chat messages={messages} onSend={() => {}} user={ME} actions={[{ title: 'Mine', action }]} />)
    await fireEvent.press(legacy.getByLabelText('Attach'))
    expect(legacy.queryByLabelText('Location')).toBeNull()
    expect(legacy.getByText('Mine')).toBeTruthy()
  })
})

describe('file bubble', () => {
  it('formats sizes and extensions as Telegram does', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(13264)).toBe('13 KB')
    expect(formatFileSize(1_300_000)).toBe('1.2 MB')
    expect(formatFileSize(undefined)).toBe('')
    expect(fileExtension('Quarterly report.pdf')).toBe('PDF')
    expect(fileExtension('archive.tar.gz')).toBe('GZ')
    expect(fileExtension('README')).toBe('')
  })

  const message: IMessage = { _id: 1, text: '', createdAt: 0, user: ME, file: PDF }

  it('shows the name, size and extension, and shares the file on tap', async () => {
    const { getByText, getByRole } = await render(<MessageFile currentMessage={message} position='left' />)
    expect(getByText('Quarterly report.pdf')).toBeTruthy()
    expect(getByText('13 KB')).toBeTruthy()
    expect(getByText('PDF')).toBeTruthy()

    await fireEvent.press(getByRole('button'))
    expect(mockShareAsync).toHaveBeenCalledWith(PDF.uri, { mimeType: PDF.mimeType, dialogTitle: PDF.name })
  })

  it('hands the tap to onPress when given', async () => {
    const onPress = jest.fn()
    const openURL = jest.spyOn(Linking, 'openURL')
    const { getByRole } = await render(<MessageFile currentMessage={message} onPress={onPress} />)
    await fireEvent.press(getByRole('button'))
    expect(onPress).toHaveBeenCalledWith(PDF)
    expect(openURL).not.toHaveBeenCalled()
  })

  it('is drawn by the bubble for IMessage.file', async () => {
    const { Bubble } = jest.requireActual('..')
    const { getByText } = await render(<Bubble currentMessage={message} position='right' user={ME} />)
    expect(getByText('Quarterly report.pdf')).toBeTruthy()
  })
})
