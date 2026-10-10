// Build: TypeScript in src/ -> one self-contained dist/index.html (script and style inline, no other files).
// One file keeps what the project relies on: it opens from disk in the tests, it deploys as a static page, and the
// page keeps working from the browser cache when the network is gone.
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// which commit this build is: the host's variable on Vercel, git anywhere else
function commit() {
  if (process.env.OL_COMMIT) return process.env.OL_COMMIT;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; }
}

/** Puts the bundled script and style inside the page and drops the separate files. */
function singleFile() {
  return {
    name: 'oito-lados:single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = Object.values(bundle).find(f => f.type === 'asset' && f.fileName.endsWith('index.html'));
      if (!page) this.error('single-file: the build produced no index.html');
      let html = String(page.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file === page) continue;
        const ref = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (file.type === 'chunk') {
          const tag = new RegExp(`<script[^>]*\\ssrc="[^"]*${ref}"[^>]*></script>`);
          if (!tag.test(html)) this.error(`single-file: no <script> tag for ${name}`);
          html = html.replace(tag, () => `<script type="module">\n${file.code.replace(/<\/script/gi, '<\\/script')}</script>`);
        } else if (name.endsWith('.css')) {
          const tag = new RegExp(`<link[^>]*\\shref="[^"]*${ref}"[^>]*>`);
          if (!tag.test(html)) this.error(`single-file: no <link> tag for ${name}`);
          html = html.replace(tag, () => `<style>\n${String(file.source).replace(/<\/style/gi, '<\\/style')}</style>`);
        } else this.error(`single-file: do not know how to inline ${name}`);
        delete bundle[name];
      }
      page.source = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, '');
    }
  };
}

export default defineConfig({
  plugins: [
    { name: 'oito-lados:commit', transformIndexHtml: html => html.replace('__OL_COMMIT__', commit()) },
    singleFile()
  ],
  build: {
    // not minified on purpose: what the tests measure (coverage by function name and line) is the file that ships
    minify: false,
    cssMinify: false,
    modulePreload: false,
    assetsInlineLimit: 0,
    reportCompressedSize: false
  }
});
