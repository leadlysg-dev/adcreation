import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap');
  
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  
  :root {
    --bg: #fafaf8;
    --surface: #ffffff;
    --surface-2: #f5f5f0;
    --border: #e5e5df;
    --border-hover: #d0d0ca;
    --text: #1a1a18;
    --text-2: #6b6b65;
    --text-3: #9a9a92;
    --accent: #c9a84c;
    --accent-bg: #faf5e8;
    --accent-border: #e8d89c;
    --info: #2563eb;
    --info-bg: #eff6ff;
    --info-border: #bfdbfe;
    --success: #16a34a;
    --success-bg: #f0fdf4;
    --danger: #dc2626;
    --danger-bg: #fef2f2;
    --radius: 8px;
    --radius-lg: 12px;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a0a0c;
      --surface: #141418;
      --surface-2: #1c1c22;
      --border: #2a2a34;
      --border-hover: #3a3a44;
      --text: #e8e6e1;
      --text-2: #8a8a84;
      --text-3: #5a5a54;
      --accent: #c9a84c;
      --accent-bg: #2a2416;
      --accent-border: #4a3e22;
      --info: #60a5fa;
      --info-bg: #172240;
      --info-border: #1e3a5f;
      --success: #4ade80;
      --success-bg: #0a2618;
      --danger: #f87171;
      --danger-bg: #2a1010;
    }
  }

  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  input, textarea, select, button {
    font-family: inherit;
    font-size: 14px;
    color: var(--text);
  }

  input[type="text"], input[type="email"], textarea {
    background: var(--surface);
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s;
  }
  input[type="text"]:focus, textarea:focus {
    border-color: var(--info);
  }

  button {
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: var(--radius);
    padding: 7px 14px;
    cursor: pointer;
    transition: all 0.12s;
  }
  button:hover { background: var(--surface-2); }
  button:active { transform: scale(0.98); }
  button:disabled { opacity: 0.4; cursor: default; }

  ::selection { background: var(--accent-bg); }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
