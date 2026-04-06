# Leadly Ad Creator

AI-powered ad creative pipeline. Upload example ads + product docs → get 5 hooks → pick 3 → generate 12 ad variations with captions, Grok image prompts, and Canva overlay specs.

## Deploy to Netlify (5 minutes)

### 1. Push to GitHub

```bash
cd leadly-ad-creator
git init
git add .
git commit -m "Leadly ad creator"
git remote add origin https://github.com/YOUR_USERNAME/leadly-ad-creator.git
git push -u origin main
```

### 2. Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Select your GitHub repo
4. Build settings should auto-detect:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy site**

### 3. Add your API key

1. Go to **Site configuration → Environment variables**
2. Add: `ANTHROPIC_API_KEY` = your Anthropic API key
3. Redeploy (Deploys → Trigger deploy)

### 4. (Optional) Custom domain

1. Go to **Domain management → Add custom domain**
2. Add `ads.leadly.sg` (or whatever you prefer)
3. Update your DNS to point to Netlify

## How it works

```
Upload (ads + docs)
  ↓
Claude analyses inputs → generates 5 hooks
  ↓
You pick 3 hooks
  ↓
Claude writes 4 variations per hook (12 total)
  each with: headline, caption, CTA, Grok prompt, Canva overlay spec
  ↓
You generate images in Grok → upload back
  ↓
Preview (card view / feed view) → download all
```

## Project structure

```
leadly-ad-creator/
├── index.html                          # Entry HTML
├── netlify.toml                        # Netlify config
├── package.json                        # Dependencies
├── vite.config.js                      # Vite config
├── src/
│   ├── main.jsx                        # React entry + global styles
│   └── App.jsx                         # Full pipeline UI
└── netlify/functions/
    └── claude-proxy.mjs                # Serverless API proxy
```

## Security

- Your Anthropic API key stays on the server (Netlify function)
- The frontend calls `/.netlify/functions/claude-proxy` instead of the Anthropic API directly
- No API key exposed in the browser

## Tech stack

- React 18 + Vite
- Netlify Functions (serverless)
- Anthropic Claude Sonnet API
- Zero other dependencies
