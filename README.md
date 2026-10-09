# My Watch Party

Watch multiple live streams at once on [mywatchparty.com](https://mywatchparty.com/).
Add Twitch, YouTube, Kick or Facebook streams; the main stream is big and plays audio,
the others stay small, muted and grayscale until you click one.

- **Add / remove / switch** streams with buttons or the keyboard (`+`, `1`–`9`, `M`).
- **Share** the current layout: the page URL holds the stream list (`?s=tw:shroud,yt:VIDEO_ID`),
  and the last session is remembered in `localStorage`.
- Minimized Twitch screens drop to their lowest quality to save bandwidth.

## Development

It's a static site: `index.html`, `main.js` and the generated `main.css`, served by GitHub Pages.

```sh
npm install
npm run watch   # rebuild main.css while editing
npm run build   # minified main.css (commit it, Pages serves it as is)
npm test        # unit tests for link parsing and share links
```

Styles live in `src/input.css` (Tailwind). Edit that file, not `main.css`.

### Adding a platform

Each platform is an entry in `PROVIDERS` in `main.js` with `embed`, `apply` (sync muted/main
state), `iframe` and `destroy`. Add a parser in `parseStreamUrl`, a short code in `SHARE_CODES`
and a label in `streamLabel`.
