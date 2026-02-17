// Favicon for stx402.com
// Design: Orange gradient background with "stx402" text

import { STX402_LOGO_PATH } from "../components/nav";

const FAVICON_SVG = `<svg width="273" height="273" viewBox="0 0 273 273" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="273" height="273" fill="url(#paint0_linear_205_42)"/>
<path d="${STX402_LOGO_PATH}" fill="white"/>
<defs>
<linearGradient id="paint0_linear_205_42" x1="273" y1="273" x2="8.99999" y2="7.99999" gradientUnits="userSpaceOnUse">
<stop offset="1" stop-color="#FC6432"/>
</linearGradient>
</defs>
</svg>`;

export function getFaviconSVG(): Response {
  return new Response(FAVICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
