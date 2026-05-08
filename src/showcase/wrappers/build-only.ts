/** Placeholder preview for targets that require a build step (Svelte, Solid). */
export function wrapBuildOnly(target: string, css: string | null): string {
  const cssTag = css ? `<style>${css}</style>` : '';
  const label = target.charAt(0).toUpperCase() + target.slice(1);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">${cssTag}
<style>
body{margin:0;padding:1rem;font-family:sans-serif;}
.note{background:#f0f4ff;border:1px solid #b0c4ff;border-radius:6px;padding:1rem;color:#334;}
</style>
</head>
<body>
<div class="note">
  <strong>${label} preview</strong> requires a build step.<br>
  Use the <em>Source</em> tab to view the compiled output.
</div>
</body>
</html>`;
}
