/** "12,345 subscribers" in a channel's header. */
export function formatSubscribers (count: number): string {
  return `${count.toLocaleString('en-US')} subscribers`
}
