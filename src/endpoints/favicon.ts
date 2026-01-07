// Favicon for stx402.com
// Design: Bitcoin orange (#f7931a) "402" badge with dark background

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a"/>
      <stop offset="100%" style="stop-color:#09090b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f7931a"/>
      <stop offset="100%" style="stop-color:#ffb347"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="32" height="32" rx="6" fill="url(#bg)"/>
  <!-- Border accent -->
  <rect x="1" y="1" width="30" height="30" rx="5" fill="none" stroke="url(#accent)" stroke-width="1.5" opacity="0.8"/>
  <!-- 402 text -->
  <text x="16" y="21" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="url(#accent)" text-anchor="middle">402</text>
  <!-- Small Bitcoin circle accent -->
  <circle cx="16" cy="8" r="2.5" fill="url(#accent)" opacity="0.9"/>
</svg>`;

export function getFaviconSVG(): Response {
  return new Response(FAVICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// Also export as data URI for embedding in HTML
export const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
