import { getExpoFileSystem } from '../optional'

export async function discardRecording (uri: string, discard?: (uri: string) => void | Promise<void>) {
  await Promise.resolve().then(async () => {
    if (discard) {
      await discard(uri)
    } else if (uri.startsWith('blob:')) {
      URL.revokeObjectURL(uri)
    } else {
      const File = getExpoFileSystem()?.File
      if (File && uri.startsWith('file://'))
        new File(uri).delete()
    }
  }).catch(() => {})
}
