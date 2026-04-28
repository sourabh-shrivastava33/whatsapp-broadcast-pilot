/**
 * nanoid — tiny unique ID generator.
 * No external dependency needed for demo purposes.
 */
export function nanoid(size = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const randomValues = new Uint8Array(size)
  window.crypto.getRandomValues(randomValues)
  for (let i = 0; i < size; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}
