# Setup, run and test

The team tested these steps on Nov 3, 2026, on a fresh copy of commit `463c3f6`, on Windows 11 in Git Bash with Node.js 25.6.1. Node.js 22 and 24 weren't available to test. No accounts, keys or logins are needed for the demo.

1. Install Node.js 22 or 24 (from nodejs.org) and Git (from git-scm.com). Open a terminal: Terminal on a Mac, or Git Bash on Windows (it comes with Git). Type every command below into that terminal.
2. Download the code:

   ```bash
   git clone https://github.com/RikepilB/team-oasis-c1.git
   cd team-oasis-c1
   ```

3. Optional: to run exactly the version a hand-over record names, check out its commit, for example `git checkout 463c3f6e31985b16a0107ab5d2286383b5914e11`. Git will say you are in a "detached HEAD" state. That's expected.
4. Install the dependencies. It installs the exact versions in `package-lock.json` and takes about 3 minutes.

   ```bash
   npm ci
   ```

5. Start the demo with its fictional data, and leave this terminal running:

   ```bash
   SYNAPSE_DATA_DIR=data/fixtures/demo npm run dev -- --hostname 127.0.0.1 --port 3019
   ```

   In Windows PowerShell instead of Git Bash, run `$env:SYNAPSE_DATA_DIR = "data/fixtures/demo"` first, then `npm run dev -- --hostname 127.0.0.1 --port 3019`. If PowerShell says running scripts is disabled, type `npm.cmd` and `npx.cmd` instead of `npm` and `npx` in every step. The team didn't test the PowerShell form.
6. Open http://127.0.0.1:3019 and follow the README's "Walkthrough": open the sample report as Daniel (preparer), then switch to the Bilingual Content Coordinator, then the Director. The AI answers are recorded replays, so the AI steps need no key or internet connection. Reports, approvals and exports are saved only on your computer.
7. Check the setup: http://127.0.0.1:3019/api/health should show `"storage":"file"`, `"provider":"replay"` and `"identity":"demo"`.
8. Stop the demo first (click its terminal and press Ctrl+C), then run the automated tests:

   ```bash
   npx vitest run --testTimeout=30000
   ```

   Expected: 237 passed, 13 skipped. The skipped tests need a test PostgreSQL database (11) or the organisers' challenge pack, which isn't in the repository (2). Plain `npm test` uses a 5-second limit per test, and on a slower computer one end-to-end test can run past it.
9. Check the code and the build. Each should finish with no errors:

   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

10. Optional, live AI: copy `.env.example` to `.env.local` and add your organisation's own Anthropic API key there. Run `npm run ai:check`, then add the line `AI_MODE=live` to `.env.local`, stop the demo with Ctrl+C and run step 5 again. The team never tested this end to end. Keep the key only in `.env.local` and never commit it.
11. Optional, hosting: the README's "Verify and deploy" section covers hosting on Vercel with PostgreSQL and Redis, using your own accounts.
