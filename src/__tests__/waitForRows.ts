import { act } from '@testing-library/react-native'

/**
 * `Chat` mounts its message rows a frame after it opens, so the header and composer paint
 * first. A test that looks at the rows waits for that frame, rather than racing it.
 */
export const waitForRows = () => act(async () => {
  await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
})
