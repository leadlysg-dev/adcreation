const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad JSON" }) }; }

  const { imageUrl, ad, config } = body;
  if (!ad) return { statusCode: 400, headers, body: JSON.stringify({ error: "ad object required" }) };

  const cfg = config || {};
  const S = 1080;
  const hl = cfg.topLine || cfg.headline || {};
  const fontSize = hl.font_size || 56;
  const lineH = hl.line_height || 68;
  const hlX = hl.x || 65;
  const hlY = hl.y || 80;
  const hlColor = hl.color || "#ffffff";
  const accentColor = hl.accent_color || "#D4A853";
  const accentWords = (hl.accent_words || "pays").toLowerCase().split(",").map(w => w.trim());

  const topH = S * ((cfg.top_gradient || {}).height_pct || 50) / 100;
  const topOp = ((cfg.top_gradient || {}).opacity || 72) / 100;
  const bbH = (cfg.bottom_bar || {}).height || 180;
  const bbOp = ((cfg.bottom_bar || {}).opacity || 88) / 100;
  const bbColor = (cfg.bottom_bar || {}).color || "#14120c";

  const st = cfg.subLine || cfg.subtext || {};
  const ct = cfg.ctaBtn || cfg.cta || {};
  const cs = cfg.ctaSub || cfg.cta_sub || {};
  const tl = cfg.bottomTag || cfg.tagline || {};
  const br = cfg.brand || {};

  // Word-wrap headline (approximate: 0.6 * fontSize per char)
  const charW = fontSize * 0.58;
  const maxW = S - 140;
  const words = (ad.headline || "").split(" ");
  let lines = [], cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (test.length * charW > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);

  // Build SVG text elements for headline with accent coloring
  let headlineSVG = "";
  lines.forEach((line, i) => {
    const y = hlY + fontSize + i * lineH;
    const lineWords = line.split(" ");
    let spans = "";
    lineWords.forEach((w, wi) => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, "");
      const fill = accentWords.includes(clean) ? accentColor : hlColor;
      const space = wi < lineWords.length - 1 ? " " : "";
      spans += `<tspan fill="${fill}">${escXml(w + space)}</tspan>`;
    });
    headlineSVG += `<text x="${hlX}" y="${y}" font-family="'Helvetica Neue',Arial,sans-serif" font-weight="bold" font-size="${fontSize}" fill="${hlColor}">${spans}</text>`;
  });

  const subY = hlY + fontSize + lines.length * lineH + (st.y_offset || 28);
  const ctaFontSize = ct.font_size || 20;
  const ctaText = (ct.uppercase !== false) ? (ad.cta || "").toUpperCase() : (ad.cta || "");
  const ctaTextW = ctaText.length * ctaFontSize * 0.6;
  const ctaPadH = 28, ctaPadV = 14;
  const ctaW = ctaTextW + ctaPadH * 2;
  const ctaH = ctaFontSize + ctaPadV * 2;
  const ctaY = S - (ct.y_from_bottom || 95) - ctaH;
  const ctaRadius = ct.radius || 6;
  const pillColor = ct.pill_color || "#D4A853";
  const ctaTextColor = ct.text_color || "#000000";

  const csText = (cs.uppercase !== false) ? (ad.cta_sub || "").toUpperCase() : (ad.cta_sub || "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity="${topOp}"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${bbColor}" stop-opacity="0"/>
    <stop offset="40%" stop-color="${bbColor}" stop-opacity="${bbOp}"/>
    <stop offset="100%" stop-color="${bbColor}" stop-opacity="${bbOp}"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="${S}" height="${topH}" fill="url(#tg)"/>
<rect x="0" y="${S - bbH - 80}" width="${S}" height="${bbH + 80}" fill="url(#bg)"/>
${headlineSVG}
<text x="${hlX}" y="${subY}" font-family="'Helvetica Neue',Arial,sans-serif" font-size="${st.font_size || 24}" fill="${st.color || '#ffffffcc'}">${escXml(ad.subtext || "")}</text>
<rect x="${hlX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaRadius}" fill="${pillColor}"/>
<text x="${hlX + ctaPadH}" y="${ctaY + ctaH - ctaPadV + 2}" font-family="'Helvetica Neue',Arial,sans-serif" font-weight="bold" font-size="${ctaFontSize}" fill="${ctaTextColor}">${escXml(ctaText)}</text>
<text x="${hlX}" y="${ctaY + ctaH + (cs.font_size || 15) + 12}" font-family="'Helvetica Neue',Arial,sans-serif" font-size="${cs.font_size || 15}" fill="${cs.color || '#ffffffaa'}">${escXml(csText)}</text>
<text x="${hlX}" y="${S - (tl.y_from_bottom || 22)}" font-family="'Helvetica Neue',Arial,sans-serif" font-size="${tl.font_size || 16}" fill="${tl.color || '#ffffff70'}">${escXml(ad.tagline || "")}</text>
<text x="${S - (br.x_from_right || 40)}" y="${S - (br.y_from_bottom || 22)}" font-family="'Helvetica Neue',Arial,sans-serif" font-weight="bold" font-size="${br.font_size || 16}" fill="${br.color || '#ffffff66'}" text-anchor="end">${escXml(ad.brand || "")}</text>
</svg>`;

  return { statusCode: 200, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ svg }) };
};

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

module.exports = { handler };
