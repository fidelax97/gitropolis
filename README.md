# Gitropolis

**Your GitHub contributions, reimagined as a living 3D city.**

Explore 30 days of GitHub activity as a miniature night city, with contribution-based buildings, forests, pedestrians and traffic.

Built with Vue 3, TypeScript, Vite, Three.js, TresJS and Cientos.

## Run locally

Requires Node.js **22.12+**, npm and a WebGL 2-capable browser.

Clone or download this repository, then open a terminal in the project folder.

**Windows PowerShell:**

```powershell
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

**macOS/Linux:**

```sh
npm ci
if [ ! -f .env.local ]; then cp .env.example .env.local; fi
npm run dev
```

Open the Local URL printed in the terminal, usually http://127.0.0.1:5173. Press **Ctrl+C** to stop the server.

The default demo needs no token. These commands preserve an existing `.env.local`; use `VITE_DATA_MODE=mock` for demo mode.

## Live GitHub data

Create a [GitHub classic personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic), starting with only `read:user`. Prefer a dedicated account without private-repository access.

After checking contribution visibility for your token, update `.env.local`:

```dotenv
GITHUB_TOKEN=your_github_token
GITHUB_VISIBILITY_VERIFIED=true
VITE_DATA_MODE=live
```

Restart the server, enter a GitHub username and select **Generate city**. **Explore demo** returns to sample data.

`GITHUB_VISIBILITY_VERIFIED` is a manual acknowledgement of your visibility checks, not an automatic token check. The minimum token permissions and private-count behavior remain unverified.

Keep `.env.local` private. Never commit the token or prefix it with `VITE_`.

Use `npm run dev` for live lookup: it runs both the frontend and API locally. `npm run preview` serves only the built frontend. No Vercel account is needed.

## Features and controls

- 30 UTC dates, oldest to newest; today is marked in progress.
- Logarithmic building heights, capped at 50 contributions; actual counts remain visible.
- Forest plots for zero-contribution days.
- Pedestrians and cars obey traffic signals; cars follow loops with left and right turns.
- Drag to orbit, scroll/pinch to zoom, hover to preview and click/tap to pin.
- Escape or Clear removes selection; the date selector supports keyboard access.
- **Pause street activity** freezes traffic. Reduced-motion preferences also keep it still.

Customize the city in `src/config/city.ts` and UI styles in `src/style.css`.

## Contribution data

GitHub contributions include qualifying activity beyond commits. Private counts depend on profile visibility and token access. Restricted aggregates are shown separately and never added to buildings; zero counts do not prove an absence of private work.

See [GitHub's contribution rules](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference).

## Development checks

```sh
npm test
npm run typecheck
npm run build
npm audit
```

Use `npm.cmd` in PowerShell. Tests, builds, dependency audit and rendered behavior remain pending owner verification.

## License

[MIT](LICENSE) — Copyright (c) 2026 FX.
