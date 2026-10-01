const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Opened just now", "Opened 5 min ago", "Opened 2h ago", "Opened yesterday", "Opened 12 Sep". */
export function formatOpened(time: number, now = Date.now()): string {
  return `Opened ${formatAgo(time, now)}`
}

/** Short relative time used across the UI (DESIGN.md: plain numbers, no emoji). */
export function formatAgo(time: number, now = Date.now()): string {
  const diff = Math.max(0, now - time)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  const then = new Date(time)
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (time >= startOfToday) return `${Math.floor(diff / HOUR)}h ago`
  if (time >= startOfToday - DAY) return 'yesterday'
  if (time >= startOfToday - 6 * DAY) return `${Math.ceil((startOfToday - time) / DAY)} days ago`
  const date = `${then.getDate()} ${MONTHS[then.getMonth()]}`
  return then.getFullYear() === today.getFullYear() ? date : `${date} ${then.getFullYear()}`
}
