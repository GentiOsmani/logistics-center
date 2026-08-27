// Fires a GitHub `repository_dispatch` event so the static site rebuilds and
// redeploys shortly after an admin save. Requires GH_REPO ("owner/repo") and
// GH_DISPATCH_TOKEN (a fine-grained PAT scoped to this repo's Actions: write)
// as Worker secrets — see deploy/README.md. Silently no-ops if they aren't
// set, so local/dev use doesn't require them.
export async function triggerRebuild(env) {
  if (!env.GH_REPO || !env.GH_DISPATCH_TOKEN) return;
  try {
    await fetch(`https://api.github.com/repos/${env.GH_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'logistics-center-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'content-updated' }),
    });
  } catch (error) {
    console.error('rebuild trigger failed', error);
  }
}
