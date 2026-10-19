import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { templateCompilerOptions } from '@tresjs/core'
import { createContributionsHandler, type ContributionRequest, type ContributionResponse } from './api/github/contributions'

function localGithubApi(): Plugin {
  return {
    name: 'gitropolis-local-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, ['GITHUB_TOKEN', 'GITHUB_VISIBILITY_VERIFIED'])
      const handler = createContributionsHandler({
        token: () => env.GITHUB_TOKEN,
        verified: () => env.GITHUB_VISIBILITY_VERIFIED === 'true',
      })

      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        if (url.pathname !== '/api/github/contributions') {
          next()
          return
        }

        const usernames = url.searchParams.getAll('username')
        const apiRequest = request as ContributionRequest
        apiRequest.query = { username: usernames.length > 1 ? usernames : usernames[0] }

        const apiResponse = response as ContributionResponse
        apiResponse.status = code => {
          response.statusCode = code
          return apiResponse
        }
        apiResponse.json = body => {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(body))
          return apiResponse
        }

        void handler(apiRequest, apiResponse).catch(() => {
          if (response.writableEnded) return
          if (response.headersSent) {
            response.end()
            return
          }
          response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          response.end(JSON.stringify({ error: { code: 'SERVICE_ERROR', message: 'The local contribution service is unavailable. Please try again.' } }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [localGithubApi(), vue({ ...templateCompilerOptions })],
  build: { chunkSizeWarningLimit: 750 },
})
