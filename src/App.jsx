import { useState, useRef, useCallback } from 'react';

const API_CLAUDE = '/.netlify/functions/claude-proxy';
const API_GROK = '/.netlify/functions/grok-image';
const API_OVERLAY = '/.netlify/functions/render-overlay';

async function callClaude(system, messages) {
  const res = await fetch(API_CLAUDE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, messages, max_tokens: 8000 }) });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Function returned HTML (status ' + res.status + ')');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content.filter(c => c.type === 'text').map(c => c.text).join('');
}
async function callGrokImage(prompt) {
  const res = await fetch(API_GROK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Grok returned HTML (status ' + res.status + ')');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.data?.[0]?.url || null;
}
async function getOverlaySVG(imageUrl, ad, config) {
  const res = await fetch(API_OVERLAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, ad, config }) });
  const data = await res.json(); return data.svg || null;
}
function compositeImageWithSVG(imageUrl, svgString) {
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const Z = 1080, c = document.createElement('canvas'); c.width = Z; c.height = Z;
      const ctx = c.getContext('2d'), scale = Math.max(Z / img.width, Z / img.height);
      ctx.drawImage(img, (Z - img.width * scale) / 2, (Z - img.height * scale) / 2, img.width * scale, img.height * scale);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' }), svgUrl = URL.createObjectURL(svgBlob);
      const si = new Image();
      si.onload = () => { ctx.drawImage(si, 0, 0, Z, Z); URL.revokeObjectURL(svgUrl); resolve(c.toDataURL('image/jpeg', 0.95)); };
      si.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); }; si.src = svgUrl;
    }; img.onerror = () => resolve(null); img.src = imageUrl;
  });
}
function parseJSON(text) { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
function fileToBase64(file) { return new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.onerror = () => j(new Error('Read failed')); f.readAsDataURL(file); }); }

const DEFAULT_OVERLAY = {
  headline: { y: 80, x: 65, font_size: 56, line_height: 68, color: '#ffffff', accent_words: 'pays', accent_color: '#D4A853' },
  subtext: { y_offset: 28, font_size: 24, color: '#ffffffcc' },
  top_gradient: { height_pct: 50, opacity: 72 },
  bottom_bar: { height: 180, opacity: 88, color: '#14120c' },
  cta: { y_from_bottom: 95, font_size: 20, pill_color: '#D4A853', text_color: '#000000', radius: 6, uppercase: true },
  cta_sub: { font_size: 15, color: '#ffffffaa', uppercase: true },
  tagline: { font_size: 16, color: '#ffffff70' },
  brand: { font_size: 16, color: '#ffffff66' },
};

const $ = {
  page: { maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' },
  card: { background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 },
  hint: { fontSize: 12, color: 'var(--text-3)', marginTop: 4 },
  badge: (t) => ({ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 'var(--radius)', background: `var(--${t}-bg)`, color: `var(--${t})` }),
  chip: (on) => ({ padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer', background: on ? 'var(--info-bg)' : 'transparent', color: on ? 'var(--info)' : 'var(--text-2)', border: on ? '0.5px solid var(--info-border)' : '0.5px solid var(--border)', transition: 'all 0.12s' }),
  btn: { padding: '8px 20px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--info-bg)', color: 'var(--info)', border: '0.5px solid var(--info-border)' },
  btnG: { padding: '8px 20px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--success-bg)', color: 'var(--success)', border: '0.5px solid var(--success)' },
  modeBtn: (on) => ({ flex: 1, padding: '14px 16px', fontSize: 14, fontWeight: 500, borderRadius: 'var(--radius-lg)', cursor: 'pointer', background: on ? 'var(--info-bg)' : 'var(--surface)', color: on ? 'var(--info)' : 'var(--text-3)', border: on ? '2px solid var(--info)' : '0.5px solid var(--border)', textAlign: 'center', transition: 'all 0.15s' }),
};

function StepBar({ steps, current }) {
  return (<div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '0.5px solid var(--border)', paddingBottom: '1rem' }}>
    {steps.map((s, i) => (<div key={s} style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, background: i < current ? 'var(--success-bg)' : i === current ? 'var(--info-bg)' : 'var(--surface-2)', color: i < current ? 'var(--success)' : i === current ? 'var(--info)' : 'var(--text-3)', border: i === current ? '2px solid var(--info)' : '0.5px solid var(--border)' }}>{i < current ? '\u2713' : i + 1}</div>
      <div style={{ fontSize: 11, marginTop: 4, color: i === current ? 'var(--text)' : 'var(--text-3)', fontWeight: i === current ? 500 : 400 }}>{s}</div>
    </div>))}
  </div>);
}
function DropZone({ label, hint, files, setFiles, accept }) {
  const ref = useRef(); const [drag, setDrag] = useState(false);
  const handle = (e) => { e.preventDefault(); setDrag(false); const f = Array.from(e.dataTransfer?.files || e.target.files || []); if (f.length) setFiles(p => [...p, ...f]); };
  return (<div style={{ marginBottom: '1.25rem' }}>
    <label style={$.label}>{label}</label>
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={handle} onClick={() => ref.current?.click()} style={{ border: `1.5px dashed ${drag ? 'var(--info)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: drag ? 'var(--info-bg)' : 'transparent' }}>
      <input ref={ref} type="file" accept={accept} multiple onChange={handle} style={{ display: 'none' }} /><p style={{ fontSize: 13, color: 'var(--text-3)' }}>Drop files or click to browse</p></div>
    {hint && <p style={$.hint}>{hint}</p>}
    {files.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{files.map((f, i) => <span key={i} style={{ ...$.badge('info'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>{f.name}<span onClick={e => { e.stopPropagation(); setFiles(p => p.filter((_, j) => j !== i)); }} style={{ cursor: 'pointer', opacity: 0.6 }}>x</span></span>)}</div>}
  </div>);
}
function CopyBtn({ text, label = 'Copy' }) { const [ok, setOk] = useState(false); return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }} style={{ fontSize: 11, padding: '2px 8px' }}>{ok ? 'Copied' : label}</button>; }
function Slider({ label, value, onChange, min = 0, max = 100, unit = '' }) { return (<div style={{ marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span style={{ color: 'var(--text-2)' }}>{label}</span><span style={{ color: 'var(--text-3)' }}>{Math.round(value)}{unit}</span></div><input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} /></div>); }
function ColorPick({ label, value, onChange }) { return (<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><input type="color" value={(value || '#ffffff').slice(0, 7)} onChange={e => onChange(e.target.value)} style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }} /><span style={{ fontSize: 11, color: 'var(--text-2)' }}>{label}</span></div>); }
function CfgSection({ title, open, toggle, children }) { return (<div style={{ borderBottom: '0.5px solid var(--border)', paddingBottom: 6, marginBottom: 6 }}><div onClick={toggle} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '3px 0' }}><span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{open ? '\u25B2' : '\u25BC'}</span></div>{open && <div style={{ paddingTop: 4 }}>{children}</div>}</div>); }

export default function App() {
  const [mode, setMode] = useState(null); // null = choose, 'static' = full pipeline, 'captions' = captions only
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [error, setError] = useState(null);

  const [exampleAds, setExampleAds] = useState([]);
  const [productDocs, setProductDocs] = useState([]);
  const [refOverlays, setRefOverlays] = useState([]);
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState('Meta (FB/IG)');
  const [cta, setCta] = useState('Lead form fill');

  const [hooks, setHooks] = useState([]);
  const [selected, setSelected] = useState([]);

  const [ads, setAds] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [finalImages, setFinalImages] = useState({});
  const [imgProgress, setImgProgress] = useState({ done: 0, total: 0, current: '' });

  const [overlayConfig, setOverlayConfig] = useState(DEFAULT_OVERLAY);
  const [showEditor, setShowEditor] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (s) => setOpenSections(p => ({ ...p, [s]: !p[s] }));
  function setCfg(sec, key, val) { setOverlayConfig(p => ({ ...p, [sec]: { ...p[sec], [key]: val } })); }

  const isStatic = mode === 'static';
  const steps = isStatic ? ['Upload', 'Pick 2 hooks', 'Generate all', 'Preview'] : ['Upload', 'Pick 2 hooks', 'Generate captions', 'Export'];

  const analyse = async () => {
    setLoading(true); setLoadMsg('Analysing...'); setError(null);
    try {
      const content = [];
      for (const f of exampleAds) { if (f.type.startsWith('image/')) content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: await fileToBase64(f) } }); }
      for (const f of refOverlays) { if (f.type.startsWith('image/')) content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: await fileToBase64(f) } }); }
      for (const f of productDocs) {
        if (f.type === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileToBase64(f) } });
        else content.push({ type: 'text', text: `[${f.name}]\n${await f.text()}` });
      }
      content.push({ type: 'text', text: `Analyse these and generate exactly 3 hooks/angles.\n\nPlatform: ${platform} | CTA: ${cta}\nObjective: ${objective || 'Infer'}\nAudience: ${audience || 'Infer'}\n\nReturn ONLY JSON array of 3 objects:\n{ "title": "hook name", "description": "2-3 sentences", "why": "1 sentence", "emotionalTrigger": "fear|guilt|aspiration|logic|urgency" }` });
      const text = await callClaude('You are Leadly\'s ad strategist for Singapore social ads. Output ONLY valid JSON.', [{ role: 'user', content }]);
      setHooks(parseJSON(text)); setError(null); setStep(1);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const generateAll = async () => {
    setLoading(true); setError(null);
    try {
      const chosen = selected.map(i => hooks[i]);
      const allAds = [];
      const extraFields = isStatic
        ? ', imagePrompt (Grok scene, SG demographics, end "No text on image. Aspect ratio 1:1."), tagline (bottom text), brand ("Legacy Planners"), cta_sub ("$0 upfront cost with MediSave"), subtext (1 line under headline)'
        : '';

      for (let h = 0; h < chosen.length; h++) {
        setLoadMsg(`Writing ${isStatic ? 'ads' : 'captions'} for hook ${h + 1}/3...`);
        const text = await callClaude(
          'You are Leadly\'s ad copywriter for Singapore Meta ads. Output ONLY valid JSON array.',
          [{ role: 'user', content: `Generate exactly 3 variations for:\n\nHOOK: "${chosen[h].title}" — ${chosen[h].description}\n\nPlatform: ${platform} | CTA: ${cta} | Objective: ${objective} | Audience: ${audience}\n\nEach object: hookIndex (${h}), hookTitle ("${chosen[h].title}"), headline (<40ch), primaryText (3-5 paragraphs \\n\\n), description (<90ch), cta (button text)${extraFields}\n\nReturn JSON array of 3. DISTINCTLY different.` }]
        );
        allAds.push(...parseJSON(text));
      }
      setAds(allAds);

      // If static mode: generate images + overlays
      if (isStatic) {
        setLoadMsg('Generating images via Grok...');
        setImgProgress({ done: 0, total: allAds.length, current: '' });
        const grokResults = {};
        for (let i = 0; i < allAds.length; i++) {
          setImgProgress({ done: i, total: allAds.length, current: allAds[i].headline });
          try { const url = await callGrokImage(allAds[i].imagePrompt); if (url) { grokResults[i] = url; setImageUrls(p => ({ ...p, [i]: url })); } }
          catch (e) { console.error(`Image ${i + 1} failed:`, e.message); }
        }

        setLoadMsg('Applying text overlays...');
        setImgProgress({ done: 0, total: Object.keys(grokResults).length, current: '' });
        let oDone = 0;
        for (const [idx, grokUrl] of Object.entries(grokResults)) {
          setImgProgress({ done: oDone, total: Object.keys(grokResults).length, current: allAds[idx].headline });
          try {
            const svg = await getOverlaySVG(grokUrl, allAds[idx], overlayConfig);
            if (svg) { const final = await compositeImageWithSVG(grokUrl, svg); if (final) setFinalImages(p => ({ ...p, [idx]: final })); }
          } catch (e) { console.error(`Overlay ${idx} failed:`, e.message); }
          oDone++;
        }
      }

      setImgProgress({ done: 0, total: 0, current: '' });
      setError(null); setStep(3);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const toggleHook = (i) => setSelected(p => p.includes(i) ? p.filter(x => x !== i) : p.length >= 2 ? p : [...p, i]);
  const getImg = (i) => finalImages[i] || imageUrls[i] || null;

  const exportAll = async () => {
    setLoading(true); setLoadMsg('Packaging your export...');
    try {
      // Load JSZip from CDN
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const zip = new window.JSZip();

      // Generate CSV
      const esc = (s) => '"' + (s || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
      const header = isStatic ? 'Ad #,Hook,Headline,Primary Text,Description,CTA,Subtext,Tagline,Image Filename' : 'Ad #,Hook,Headline,Primary Text,Description,CTA';
      const csvRows = [];

      // Process each ad
      for (let i = 0; i < ads.length; i++) {
        const ad = ads[i];
        const hookNum = (ad.hookIndex ?? 0) + 1;
        const varNum = (i % 3) + 1;
        // Clean headline for filename: lowercase, replace spaces with underscores, remove special chars
        const cleanHeadline = (ad.headline || 'ad').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
        const imgName = `hook${hookNum}_ad${varNum}_${cleanHeadline}.jpg`;

        // Add image to zip if static mode
        if (isStatic) {
          const src = getImg(i);
          if (src) {
            setLoadMsg(`Packaging image ${i + 1}/${ads.length}...`);
            try {
              let base64;
              if (src.startsWith('data:')) {
                // Already a data URL (overlaid image) — extract base64
                base64 = src.split(',')[1];
              } else {
                // External URL (Grok image) — proxy through server to bypass CORS
                const proxyRes = await fetch('/.netlify/functions/image-proxy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: src }),
                });
                const proxyData = await proxyRes.json();
                if (proxyData.base64) base64 = proxyData.base64;
              }
              if (base64) zip.file(imgName, base64, { base64: true });
            } catch (e) { console.error(`Image ${i + 1} zip failed:`, e); }
          }
        }

        // Build CSV row
        const base = [i + 1, esc(ad.hookTitle), esc(ad.headline), esc(ad.primaryText), esc(ad.description), esc(ad.cta)];
        if (isStatic) base.push(esc(ad.subtext), esc(ad.tagline), esc(imgName));
        csvRows.push(base.join(','));
      }

      // Add CSV to zip
      zip.file('ad-captions.csv', header + '\n' + csvRows.join('\n'));

      // Generate and download zip
      setLoadMsg('Creating zip file...');
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'leadly-ads-export.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setError('Export failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const exportConfig = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(overlayConfig, null, 2)], { type: 'application/json' })); a.download = 'overlay_config.json'; a.click(); };
  const importConfig = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { setOverlayConfig(JSON.parse(r.result)); } catch {} }; r.readAsText(f); };

  // ═══ Mode selection screen ═══
  if (mode === null) return (
    <div style={$.page}>
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>S</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>Static Ad Generator</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: '2.5rem' }}>by Leadly</p>

        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: '1.5rem' }}>What do you need?</p>

        <div style={{ display: 'flex', gap: 12, maxWidth: 500, margin: '0 auto' }}>
          <div onClick={() => setMode('static')} style={$.modeBtn(false)}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#x1f5bc;</div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Static ads</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Full pipeline: captions + AI images + text overlay</div>
          </div>
          <div onClick={() => setMode('captions')} style={$.modeBtn(false)}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#x270d;</div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Captions only</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Just headlines, copy, and CTAs for your own videos/images</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══ Main app ═══
  return (
    <div style={$.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>S</div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>Static Ad Generator</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{isStatic ? 'Captions + images + overlays' : 'Captions only'}</p>
            <button onClick={() => { setMode(null); setStep(0); setAds([]); setHooks([]); setSelected([]); setImageUrls({}); setFinalImages({}); }} style={{ fontSize: 10, padding: '1px 6px', color: 'var(--text-3)', cursor: 'pointer' }}>Switch mode</button>
          </div>
        </div>
      </div>

      <StepBar steps={steps} current={step} />

      {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: '1rem' }}>{error} <button onClick={() => setError(null)} style={{ marginLeft: 8, fontSize: 11, color: 'var(--danger)', border: 'none', background: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Dismiss</button></div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTop: '2.5px solid var(--info)', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>{loadMsg}</p>
          {imgProgress.total > 0 && <div style={{ maxWidth: 300, margin: '12px auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}><span>{imgProgress.done}/{imgProgress.total}</span><span>{Math.round((imgProgress.done / imgProgress.total) * 100)}%</span></div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', background: 'var(--success)', borderRadius: 2, width: `${(imgProgress.done / imgProgress.total) * 100}%`, transition: 'width 0.3s' }} /></div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{imgProgress.current}</p>
          </div>}
        </div>
      )}

      {!loading && <>
        {/* STEP 0: Upload */}
        {step === 0 && <div>
          <DropZone label={isStatic ? 'Example ads (screenshots)' : 'Example ads or video thumbnails'} hint="Your top performing creatives" files={exampleAds} setFiles={setExampleAds} accept="image/*" />
          <DropZone label="Product documents" hint="Brochures, policy docs, landing page copy" files={productDocs} setFiles={setProductDocs} accept=".pdf,.txt,.md,.doc,.docx" />
          {isStatic && <DropZone label="Reference overlay designs (optional)" hint="Ad images with text overlays you like — AI will match the style" files={refOverlays} setFiles={setRefOverlays} accept="image/*" />}
          <div style={{ marginBottom: '1.25rem' }}><label style={$.label}>Ad objective</label><textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} placeholder="e.g. Drive lead form fills for disability insurance, SG 30-55" style={{ resize: 'vertical', lineHeight: 1.6 }} /></div>
          <div style={{ marginBottom: '1.25rem' }}><label style={$.label}>Target audience</label><textarea value={audience} onChange={e => setAudience(e.target.value)} rows={2} placeholder="e.g. Singapore working adults 30-55" style={{ resize: 'vertical', lineHeight: 1.6 }} /></div>
        </div>}

        {/* STEP 1: Pick hooks */}
        {step === 1 && <div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: '1rem', lineHeight: 1.6 }}>Pick exactly 2 hooks. {isStatic ? 'One click generates ads, images, and overlays.' : 'One click generates all captions.'}</p>
          {hooks.map((h, i) => <div key={i} onClick={() => toggleHook(i)} style={{ ...$.card, cursor: 'pointer', border: selected.includes(i) ? '2px solid var(--info)' : $.card.border, background: selected.includes(i) ? 'var(--info-bg)' : $.card.background }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={$.badge('info')}>Hook {i + 1}</span><span style={$.badge('accent')}>{h.emotionalTrigger}</span></div>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: selected.includes(i) ? '2px solid var(--info)' : '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected.includes(i) && <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--info)' }} />}</div>
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{h.title}</p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{h.description}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>{h.why}</p>
          </div>)}
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{selected.length}/2 selected</p>
        </div>}

        {/* STEP 3: Results */}
        {step === 3 && <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{ads.length} {isStatic ? 'ads' : 'captions'}</span>
              {isStatic && <button onClick={() => setShowEditor(!showEditor)} style={$.chip(showEditor)}>{showEditor ? 'Hide editor' : 'Overlay config'}</button>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportAll} style={$.btnG}>Export all (ZIP)</button>
            </div>
          </div>

          {/* Overlay editor */}
          {isStatic && showEditor && <div style={{ ...$.card, background: 'var(--surface-2)', border: 'none', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Overlay config</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={exportConfig} style={{ fontSize: 10, padding: '2px 8px' }}>Export</button>
                <label style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)' }}>Import<input type="file" accept=".json" onChange={importConfig} style={{ display: 'none' }} /></label>
                <button onClick={() => setOverlayConfig(DEFAULT_OVERLAY)} style={{ fontSize: 10, padding: '2px 8px', color: 'var(--danger)' }}>Reset</button>
              </div>
            </div>
            <CfgSection title="Headline" open={openSections.hl} toggle={() => toggleSection('hl')}>
              <Slider label="Font size" value={overlayConfig.headline.font_size} onChange={v => setCfg('headline', 'font_size', v)} min={24} max={80} unit="px" />
              <Slider label="Line height" value={overlayConfig.headline.line_height} onChange={v => setCfg('headline', 'line_height', v)} min={30} max={100} unit="px" />
              <Slider label="Y position" value={overlayConfig.headline.y} onChange={v => setCfg('headline', 'y', v)} min={20} max={400} unit="px" />
              <ColorPick label="Text" value={overlayConfig.headline.color} onChange={v => setCfg('headline', 'color', v)} />
              <ColorPick label="Accent" value={overlayConfig.headline.accent_color} onChange={v => setCfg('headline', 'accent_color', v)} />
              <div style={{ marginBottom: 6 }}><label style={{ fontSize: 11, color: 'var(--text-3)' }}>Accent words</label><input value={overlayConfig.headline.accent_words} onChange={e => setCfg('headline', 'accent_words', e.target.value)} style={{ width: '100%', fontSize: 11, padding: 4, marginTop: 2 }} /></div>
            </CfgSection>
            <CfgSection title="Gradients" open={openSections.gr} toggle={() => toggleSection('gr')}>
              <Slider label="Top opacity" value={overlayConfig.top_gradient.opacity} onChange={v => setCfg('top_gradient', 'opacity', v)} min={0} max={100} unit="%" />
              <Slider label="Bottom height" value={overlayConfig.bottom_bar.height} onChange={v => setCfg('bottom_bar', 'height', v)} min={60} max={400} unit="px" />
              <Slider label="Bottom opacity" value={overlayConfig.bottom_bar.opacity} onChange={v => setCfg('bottom_bar', 'opacity', v)} min={0} max={100} unit="%" />
            </CfgSection>
            <CfgSection title="CTA button" open={openSections.ct} toggle={() => toggleSection('ct')}>
              <Slider label="Font size" value={overlayConfig.cta.font_size} onChange={v => setCfg('cta', 'font_size', v)} min={12} max={36} unit="px" />
              <Slider label="From bottom" value={overlayConfig.cta.y_from_bottom} onChange={v => setCfg('cta', 'y_from_bottom', v)} min={40} max={300} unit="px" />
              <ColorPick label="Pill" value={overlayConfig.cta.pill_color} onChange={v => setCfg('cta', 'pill_color', v)} />
              <ColorPick label="Text" value={overlayConfig.cta.text_color} onChange={v => setCfg('cta', 'text_color', v)} />
            </CfgSection>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Changes apply to next generation run.</p>
          </div>}

          {/* Ads list */}
          {selected.map((_, hi) => {
            const ha = ads.filter(a => a.hookIndex === hi);
            if (!ha.length) return null;
            return (<div key={hi}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1.5rem 0 0.75rem' }}>
                <span style={$.badge('info')}>Hook {hi + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{ha[0]?.hookTitle}</span>
              </div>

              {ha.map((ad, j) => { const gi = ads.indexOf(ad); const src = isStatic ? getImg(gi) : null; return (
                <div key={j} style={{ ...$.card, padding: 0, overflow: 'hidden' }}>
                  {/* Ad header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                    <span style={$.badge('info')}>Ad {gi + 1}</span>
                    <CopyBtn text={`${ad.headline}\n\n${ad.primaryText}\n\n${ad.description}`} />
                  </div>

                  {/* Caption section */}
                  <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{ad.headline}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: isStatic ? 3 : 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ad.primaryText}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{ad.description}</p>
                  </div>

                  {/* Meta placement previews — horizontal scroll */}
                  {isStatic && src && (
                    <div style={{ padding: '12px 0' }}>
                      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px' }}>
                        {/* Facebook Feed */}
                        <div style={{ flexShrink: 0, width: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-3)"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Facebook Feed</span>
                          </div>
                          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
                              <div><p style={{ fontSize: 10, fontWeight: 500 }}>Legacy Planners</p><p style={{ fontSize: 8, color: 'var(--text-3)' }}>Sponsored</p></div>
                            </div>
                            <p style={{ fontSize: 9, color: 'var(--text-2)', padding: '0 10px 6px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ad.primaryText}</p>
                            <img src={src} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                            <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div><p style={{ fontSize: 8, color: 'var(--text-3)' }}>{ad.description}</p><p style={{ fontSize: 10, fontWeight: 500 }}>{ad.headline}</p></div>
                              <div style={{ fontSize: 8, padding: '3px 8px', border: '0.5px solid var(--border)', borderRadius: 4 }}>{ad.cta || 'Learn more'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Instagram Feed */}
                        <div style={{ flexShrink: 0, width: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-3)"><path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 01-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 01-1.772-1.153A4.904 4.904 0 012.525 18.55c-.247-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.066.217-1.79.465-2.428a4.88 4.88 0 011.153-1.772A4.897 4.897 0 015.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.25-3.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/></svg>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Instagram Feed</span>
                          </div>
                          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
                              <p style={{ fontSize: 10, fontWeight: 500 }}>legacyplannersg</p>
                              <span style={{ fontSize: 8, color: 'var(--text-3)' }}>Sponsored</span>
                            </div>
                            <img src={src} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                            <div style={{ padding: '8px 10px' }}>
                              <p style={{ fontSize: 9, color: 'var(--text-2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}><strong>legacyplannersg</strong> {ad.primaryText}</p>
                            </div>
                          </div>
                        </div>

                        {/* Instagram Stories */}
                        <div style={{ flexShrink: 0, width: 130 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-3)"><path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 01-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 01-1.772-1.153A4.904 4.904 0 012.525 18.55c-.247-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.066.217-1.79.465-2.428a4.88 4.88 0 011.153-1.772A4.897 4.897 0 015.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.25-3.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/></svg>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>IG Stories</span>
                          </div>
                          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '0.5px solid var(--border)', aspectRatio: '9/16', position: 'relative' }}>
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                              <span style={{ fontSize: 8, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>legacyplannersg</span>
                            </div>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', background: 'rgba(0,0,0,0.4)' }}>
                              <p style={{ fontSize: 8, color: '#fff', textAlign: 'center' }}>{ad.cta || 'Learn more'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Facebook Stories */}
                        <div style={{ flexShrink: 0, width: 130 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-3)"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>FB Stories</span>
                          </div>
                          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '0.5px solid var(--border)', aspectRatio: '9/16', position: 'relative' }}>
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                              <span style={{ fontSize: 8, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Legacy Planners</span>
                            </div>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', background: 'rgba(0,0,0,0.4)' }}>
                              <p style={{ fontSize: 8, color: '#fff', textAlign: 'center' }}>{ad.cta || 'Learn more'}</p>
                            </div>
                          </div>
                        </div>
                    </div>
                  )}

                  {/* Caption-only mode: just show full text */}
                  {!isStatic && (
                    <div style={{ padding: '12px 16px' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ad.primaryText}</p>
                    </div>
                  )}

                  {/* Expandable prompts */}
                  {isStatic && ad.imagePrompt && <details style={{ padding: '0 16px 12px' }}><summary style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}>Prompts</summary>
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' }}>Grok prompt</span><CopyBtn text={ad.imagePrompt} /></div>
                      <p style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: 'var(--text-3)', background: 'var(--surface-2)', padding: '4px 6px', borderRadius: 'var(--radius)', lineHeight: 1.5, marginTop: 2 }}>{ad.imagePrompt}</p>
                    </div>
                  </details>}
                </div>
              ); })}
            </div>);
          })}
        </div>}

        {/* Nav */}
        {step <= 1 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '0.5px solid var(--border)' }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ opacity: step === 0 ? 0.3 : 1 }}>Back</button>
          {step === 0 && <button onClick={analyse} disabled={!exampleAds.length && !productDocs.length} style={{ ...$.btn, opacity: (!exampleAds.length && !productDocs.length) ? 0.4 : 1 }}>Analyse and generate hooks</button>}
          {step === 1 && <button onClick={generateAll} disabled={selected.length !== 2} style={{ ...$.btnG, opacity: selected.length !== 2 ? 0.4 : 1 }}>{isStatic ? 'Generate 6 ads + images' : 'Generate 6 captions'}</button>}
        </div>}
      </>}
    </div>
  );
}
