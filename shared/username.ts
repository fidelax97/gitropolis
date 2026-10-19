export function normalizeUsername(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Enter a GitHub username.')
  const username = input.trim().toLowerCase()
  if (username.length < 1 || username.length > 39 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) {
    throw new Error('Use a GitHub username with 1–39 letters, numbers or single hyphens between characters.')
  }
  return username
}
