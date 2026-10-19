import { describe, expect, it } from 'vitest'
import { normalizeUsername } from '../shared/username'

describe('username validation', () => {
  it.each(['octocat', 'a', 'a-b', 'a'.repeat(39)])('accepts a valid username: %s', input => {
    expect(normalizeUsername(input)).toBe(input)
  })
  it('trims and lowercases input', () => expect(normalizeUsername('  OctoCat  ')).toBe('octocat'))
  it.each(['', ' ', '-cat', 'cat-', 'a--b', 'a_b', 'a b', '@cat', 'https://github.com/cat', 'a'.repeat(40), null, ['cat']])('rejects malformed input: %j', input => {
    expect(() => normalizeUsername(input)).toThrow()
  })
})
