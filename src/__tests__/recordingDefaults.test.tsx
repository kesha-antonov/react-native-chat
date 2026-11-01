import React from 'react'
import { render } from './renderWithGestureRoot'

// A stand-in for `expo-audio`, which the library resolves as an optional peer: with it
// "installed", the mic button must show up without any recording prop.
jest.mock('expo-audio', () => ({
  useAudioRecorder: () => ({ record: () => {}, stop: async () => {}, prepareToRecordAsync: async () => {}, uri: null }),
  useAudioPlayer: () => ({}),
  useAudioPlayerStatus: () => ({}),
  RecordingPresets: { HIGH_QUALITY: {} },
  AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) },
  setAudioModeAsync: async () => {},
}), { virtual: true })

// eslint-disable-next-line import/first
import { InputToolbar } from '..'

describe('voice notes on by default', () => {
  it('shows the mic button when expo-audio is installed, with no prop', async () => {
    const { queryByLabelText } = await render(<InputToolbar text='' />)
    expect(queryByLabelText('record voice message')).toBeTruthy()
  })

  it('hides it with audioRecording={false}', async () => {
    const { queryByLabelText } = await render(<InputToolbar text='' audioRecording={false} />)
    expect(queryByLabelText('record voice message')).toBeNull()
  })

  it('hides it with audioRecording={{ isEnabled: false }}', async () => {
    const { queryByLabelText } = await render(<InputToolbar text='' audioRecording={{ isEnabled: false }} />)
    expect(queryByLabelText('record voice message')).toBeNull()
  })

  it('swaps it for the send button once there is text', async () => {
    const { queryByLabelText } = await render(<InputToolbar text='hello' />)
    expect(queryByLabelText('record voice message')).toBeNull()
  })

  it('does not offer the system camera fallback unless asked', async () => {
    // Neither vision-camera nor expo-image-picker resolve here, so no video control either way.
    const { queryByLabelText } = await render(<InputToolbar text='' />)
    expect(queryByLabelText('record video message')).toBeNull()
  })
})
