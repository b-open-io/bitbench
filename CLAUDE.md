# BitBench Project Instructions

## Vercel Environment Variables

**CRITICAL**: The Vercel project is linked at the ROOT (`/bitbench`), NOT in `/bitbench/visualizer`.

To pull env vars for local development:
```bash
# From the root bitbench folder, pull directly to visualizer:
vercel env pull visualizer/.env.local
```

**DO NOT**:
- Run `vercel env pull` from inside `visualizer/` - it's not linked there
- Pull to root `.env.local` - Next.js won't find it when running from `visualizer/`
- Keep going in circles trying different approaches

After pulling, restart the dev server for changes to take effect.
