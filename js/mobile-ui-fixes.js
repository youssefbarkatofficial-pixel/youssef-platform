/* Mobile UI fixes for منصة يوسف بركات
   - Inject mobile CSS variables and targeted overrides
   - Compact assistant bubble and normalize floating buttons
   - Replace assistant button icon with simple compass SVG (visual only)
   Safe: UI-only, no data or behavior changes. */
(function(){
  function injectStyles(){
    const css = `
:root{
  --nav-height:56px;
  --mobile-gap:8px;
  --mobile-fab-size:56px;
  --mobile-fab-secondary:48px;
  --avatar-size:36px;
  --royal-navy:#071326;
  --royal-gold:#d4a64f;
}
@media (max-width: 430px){
  /* Header */
  .navbar{ min-height:var(--nav-height); padding:8px 12px; gap:8px; display:flex; align-items:center; justify-content:space-between; }
  .navbar .brand, .navbar .logo{ max-height:40px; max-width:140px; }
  .navbar .avatar, .user-avatar{ width:var(--avatar-size); height:var(--avatar-size); border-radius:50%; object-fit:cover; }
  .navbar .nav-actions{ display:flex; gap:8px; align-items:center; }

  /* Hero */
  .hero .heading-luxury { font-size:20px !important; line-height:1.15 !important; }
  .hero-subtitle { font-size:14px !important; color:var(--text-secondary) !important; }
  .hero .hero-buttons { display:flex; gap:8px; flex-wrap:wrap; }
  .hero .hero-buttons .btn { padding:8px 12px; font-size:14px; }

  /* Cards and dashboard spacing */
  .dash-panel, .glass-panel, .card { padding:12px !important; margin-bottom:12px !important; }
  .card .card-header { font-size:15px; }

  /* Floating action buttons */
  .fab, .floating-button, .floating-action { width:var(--mobile-fab-size); height:var(--mobile-fab-size); border-radius:50%; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,0.35); }
  .fab.secondary, .floating-action.secondary { width:var(--mobile-fab-secondary); height:var(--mobile-fab-secondary); }
  .fab, .floating-action { position:fixed; right:16px; z-index:99999; }
  .fab.bottom-right { bottom: calc(16px + env(safe-area-inset-bottom)); }
  .floating-group { display:flex; flex-direction:column; gap:10px; align-items:flex-end; }

  /* Assistant bubble compact */
  .assistant-bubble, .bousala-assistant-message, .support-assistant-message { position:fixed; bottom: calc(var(--mobile-fab-size) + 26px + env(safe-area-inset-bottom)); right:16px; max-width: min(320px, calc(100vw - 110px)); padding:8px 10px; font-size:14px; line-height:1.3; border-radius:12px; background:var(--bg-secondary, rgba(10,18,28,0.95)); color:var(--text-primary); box-shadow:0 6px 18px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.04); }
  .assistant-bubble p { margin:0; }

  /* Ensure Arabic text is right aligned and readable */
  body[dir="rtl"], .rtl, [dir="rtl"] { direction:rtl; text-align:right; }
  .assistant-bubble, .hero, .dash-panel, .card { word-break:keep-all; }
  .assistant-bubble { hyphens:auto; }

  /* Compass FAB look */
  .compass-fab{ background:var(--royal-navy); border:2px solid var(--royal-gold); color:var(--royal-gold); }
  .compass-fab:focus{ outline:3px solid rgba(212,166,79,0.12); }
  .compass-fab svg{ width:56%; height:56%; fill:var(--royal-gold); }
}
`;
    const s = document.createElement('style'); s.setAttribute('data-mobile-ui-fixes','1'); s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function replaceAssistantButtonWithCompass(){
    // Try common selectors used in site for assistant button
    const possibleSelectors = [
      '.assistant-button', '.bot-button', '.bousala-fab', '#bousalaBot', '.support-bot', '.floating-bot', '.compass-button'
    ];
    let btn = null;
    for(const sel of possibleSelectors){
      btn = document.querySelector(sel);
      if(btn) break;
    }
    // Fallback: find clickable element whose aria-label or title contains 'مساعد' or 'البوصلة'
    if(!btn){
      btn = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(el=>{
        const txt = (el.getAttribute('aria-label')||'' ) + ' ' + (el.title||'') + ' ' + (el.innerText||'');
        return /مساعد|البوصلة|بوصلة|البوصلة/i.test(txt);
      });
    }
    if(!btn) return; // nothing to replace safely

    // Make it a proper button element (if it's not)
    if(btn.tagName.toLowerCase() !== 'button'){
      btn.setAttribute('role','button');
      btn.tabIndex = 0;
    }

    // Add classes for styling
    btn.classList.add('compass-fab');
    btn.classList.add('fab','bottom-right');

    // Inject inline SVG compass rose (simple)
    const svg = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="none" />
  <path d="M12 4 L15 12 L12 10 L9 12 Z" />
  <circle cx="12" cy="12" r="1.2" />
</svg>`;
    // Replace content but preserve event listeners by not replacing element
    btn.innerHTML = svg;
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'البوصلة — المساعد');
  }

  function compactAssistantMessages(){
    // Find message elements and add compact class
    const messageSelectors = ['.assistant-message', '.assistant-bubble', '.bousala-assistant-message', '.support-assistant-message', '.bot-message'];
    messageSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el=>{
        el.classList.add('assistant-bubble');
      });
    });
    // Also reduce large initial assistant greeting if present
    const bigTextNodes = Array.from(document.querySelectorAll('div, p, span')).filter(el=>{
      const txt = (el.innerText||'').trim();
      return txt.length>20 && /أنا المساعد|المساعد الذكي|أقدر أساعدك/i.test(txt);
    });
    bigTextNodes.forEach(el=>{
      el.style.fontSize = '14px';
      el.style.lineHeight = '1.3';
      el.style.maxWidth = 'min(320px, calc(100vw - 110px))';
      el.style.overflowWrap = 'break-word';
      el.style.wordBreak = 'keep-all';
    });
  }

  function init(){
    if(!document.head) return;
    injectStyles();
    // Run after small delay to allow other scripts to render assistant
    setTimeout(()=>{
      try{ replaceAssistantButtonWithCompass(); compactAssistantMessages(); }catch(e){ console.warn('mobile-ui-fixes init error', e); }
    }, 300);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
