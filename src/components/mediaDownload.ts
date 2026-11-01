/** A remote `http(s)` source, which is fetched with progress before it is decoded. */
export const isRemoteUri = (uri: string | undefined) => !!uri && /^https?:\/\//i.test(uri)

export interface Download {
  promise: Promise<ArrayBuffer>
  abort: () => void
}

/**
 * Fetches `uri` into memory, reporting 0..1 as it arrives. `XMLHttpRequest` is
 * the one React Native transport that reports download progress, which is what
 * drives the ring on a voice note being fetched. `onProgress` is not
 * called when the server sends no length.
 */
export const downloadWithProgress = (uri: string, onProgress: (fraction: number) => void): Download => {
  const xhr = new XMLHttpRequest()
  let isAborted = false
  const promise = new Promise<ArrayBuffer>((resolve, reject) => {
    xhr.open('GET', uri)
    xhr.responseType = 'arraybuffer'
    xhr.onprogress = event => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.min(1, event.loaded / event.total))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        onProgress(1)
        resolve(xhr.response as ArrayBuffer)
      } else {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.onabort = () => reject(new Error('aborted'))
    xhr.send()
  })
  return {
    promise,
    abort: () => {
      if (isAborted)
        return
      isAborted = true
      try {
        xhr.abort()
      } catch {
        // already done
      }
    },
  }
}
