export class GithubError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterSeconds?: number) {
    super(message)
    this.name = 'GithubError'
  }
}
