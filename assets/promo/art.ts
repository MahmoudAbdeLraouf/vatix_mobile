// Home promo carousel illustrations (128×128). Rendered via SvgXml.

// Geeko robot hunting with a magnifier — drawn for the navy card.
export const geekoXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<circle cx="64" cy="66" r="54" fill="rgba(255,255,255,0.08)"/>
<circle cx="64" cy="66" r="40" fill="rgba(255,255,255,0.06)"/>
<path d="M18 30l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z" fill="#F5B800" opacity=".9"/>
<path d="M108 22l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8z" fill="#fff" opacity=".7"/>
<circle cx="104" cy="100" r="2.5" fill="#fff" opacity=".5"/>
<path d="M56 30v-9" stroke="#F5B800" stroke-width="4" stroke-linecap="round"/>
<circle cx="56" cy="18" r="5" fill="#fff"/>
<rect x="18" y="48" width="7" height="16" rx="3.5" fill="#F5B800"/>
<rect x="87" y="48" width="7" height="16" rx="3.5" fill="#F5B800"/>
<rect x="24" y="30" width="64" height="50" rx="20" fill="#F5B800"/>
<rect x="34" y="42" width="44" height="21" rx="10.5" fill="#0A2E5E"/>
<circle cx="46" cy="52.5" r="4.2" fill="#F5B800"/>
<circle cx="66" cy="52.5" r="4.2" fill="#F5B800"/>
<path d="M47 70c5.5 3.2 12.5 3.2 18 0" fill="none" stroke="#0A2E5E" stroke-width="4" stroke-linecap="round"/>
<rect x="36" y="84" width="40" height="26" rx="10" fill="#F5B800"/>
<rect x="49" y="91" width="14" height="5" rx="2.5" fill="#0A2E5E" opacity=".55"/>
<path d="M76 92l12-8" stroke="#F5B800" stroke-width="6" stroke-linecap="round"/>
<circle cx="98" cy="76" r="15" fill="rgba(255,255,255,0.18)" stroke="#fff" stroke-width="5"/>
<path d="M89 85l-6 7" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
<path d="M92 73a7 7 0 0 1 7-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>
</svg>`

// A buyer request with seller offers arriving. ink = bubble/check colour,
// paper = card surface ("#fff" for light cards), accent = highlight colour.
export const requestXml = (ink: string, paper: string, accent: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<circle cx="64" cy="64" r="56" fill="${paper === '#fff' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}"/>
<rect x="14" y="20" width="66" height="44" rx="12" fill="${ink}"/>
<path d="M28 64l-4 12 14-12z" fill="${ink}"/>
<rect x="24" y="30" width="18" height="18" rx="6" fill="${accent}"/>
<path d="M30 39.5l2.6 2.6 5-5.2" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="47" y="31" width="25" height="5" rx="2.5" fill="#fff"/>
<rect x="47" y="41" width="17" height="4" rx="2" fill="#fff" opacity=".55"/>
<rect x="24" y="53" width="30" height="4" rx="2" fill="#fff" opacity=".35"/>
<g transform="translate(44 70)">
<rect width="72" height="22" rx="11" fill="#fff" stroke="${ink}" stroke-opacity=".12"/>
<circle cx="11" cy="11" r="6.5" fill="${ink}"/><path d="M8 11l2.2 2.2L14.4 9" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="22" y="8" width="26" height="6" rx="3" fill="${ink}" opacity=".25"/>
<rect x="52" y="6" width="14" height="10" rx="5" fill="${accent}"/>
</g>
<g transform="translate(36 98)">
<rect width="72" height="22" rx="11" fill="#fff" stroke="${ink}" stroke-opacity=".12"/>
<circle cx="11" cy="11" r="6.5" fill="${ink}"/><path d="M8 11l2.2 2.2L14.4 9" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="22" y="8" width="22" height="6" rx="3" fill="${ink}" opacity=".25"/>
<rect x="52" y="6" width="14" height="10" rx="5" fill="${accent}"/>
</g>
<circle cx="112" cy="70" r="9" fill="#E5484D"/><text x="112" y="74" font-weight="700" font-size="11" fill="#fff" text-anchor="middle">2</text>
</svg>`
