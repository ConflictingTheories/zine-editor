# SVRN Reader — Web Embed

Embed any published pixozine on any website, like a YouTube video. The reader
runs in a sandboxed iframe; the host page cannot touch the publication and the
publication cannot touch the host.

## Snippet

```html
<iframe
  src="https://reader.svrn.network/?embed=1&issue=<ISSUE_ID>"
  width="640"
  height="900"
  frameborder="0"
  allow="autoplay; fullscreen"
  sandbox="allow-scripts allow-same-origin"
  title="Pixozine: <TITLE>">
</iframe>
```

Replace `https://reader.svrn.network` with your reader deployment, and
`<ISSUE_ID>` with the publication's ID (or a direct `.svrn` URL — see below).

## URL scheme

```
{readerBase}/?embed=1&issue={id}&page={n}
```

| Param   | Required | Meaning |
|---------|----------|---------|
| `embed` | yes      | `1` renders chromeless (no library/import chrome) |
| `issue` | yes*     | Publication ID from the reader's library, **or** an absolute `https:` URL to a `.svrn` file (`issue=https://…/my-zine.svrn`) |
| `page`  | no       | 1-based starting page (default 1) |

\* Either a library issue ID or a direct file URL. Direct URLs let anyone embed
a pixozine they host themselves — no SVRN account required.

## Sandbox notes

- The iframe `sandbox` attribute should include at minimum `allow-scripts`
  (the reader needs JS). Add `allow-same-origin` only if the embedded
  publication loads subresources from the reader's own origin (fonts, etc.).
- **Playable embeds** inside the publication run in a *nested* sandboxed
  iframe (`allow-scripts` only, no `allow-same-origin`) — third-party game
  code never gains host capabilities, even inside an embed.
- Click-to-play: playables show a poster until the reader clicks play. Nothing
  auto-executes on page view.

## Responsive sizing

The reader scales the page to fit its container. For responsive embeds, wrap
the iframe and use aspect-ratio CSS:

```html
<div style="position:relative; padding-top:150%; max-width:640px;">
  <iframe src="…?embed=1&issue=…" style="position:absolute; inset:0; width:100%; height:100%;" …></iframe>
</div>
```

## Self-hosting

Build the reader (`npm run build` in `apps/reader`) and serve `dist-reader/`
from any static host. The player is bundled inside (`dist-reader/player/`),
so playables work with no additional deploys.
