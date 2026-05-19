import { COLORS } from "./colors";

export const EDITOR_CSS = `
  * { box-sizing: border-box; }
  body {
    background: ${COLORS.background};
    color: ${COLORS.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 16px;
    line-height: 1.7;
    padding: 8px 16px 60px;
    margin: 0;
    caret-color: ${COLORS.accent};
  }
  h1 { font-size: 24px; font-weight: 800; margin: 20px 0 8px; }
  h2 { font-size: 20px; font-weight: 700; margin: 16px 0 6px; }
  h3 { font-size: 17px; font-weight: 600; margin: 12px 0 4px; }
  p { margin: 4px 0; }
  ul, ol { padding-left: 22px; margin: 4px 0; }
  li { margin: 2px 0; }
  input[type="checkbox"] {
    accent-color: ${COLORS.accent};
    width: 16px; height: 16px;
  }
  blockquote {
    border-left: 3px solid ${COLORS.accent};
    padding: 6px 0 6px 14px; margin: 10px 0;
    color: ${COLORS.textMuted}; font-style: italic;
    background: ${COLORS.surface}60; border-radius: 0 8px 8px 0;
  }
  code {
    background: ${COLORS.surface}; color: ${COLORS.accent};
    padding: 2px 6px; border-radius: 5px;
    font-family: "SF Mono", Consolas, monospace; font-size: 13.5px;
  }
  pre {
    background: ${COLORS.surface}; border-radius: 10px; padding: 14px;
    overflow-x: auto; margin: 10px 0; border: 1px solid ${COLORS.border};
  }
  pre code { background: transparent; padding: 0; font-size: 13px; }
  hr { border: none; height: 1px; background: ${COLORS.border}; margin: 20px 0; }
  a { color: ${COLORS.accent}; text-decoration: underline; }
  img { max-width: 100%; max-height: 540px; height: auto; border-radius: 10px; margin: 10px 0; display: block; }
  video { max-width: 100%; max-height: 540px; height: auto; border-radius: 10px; margin: 10px 0; display: block; }
  .att-chip { display:inline-flex; align-items:center; gap:10px; background:#1a2535; border:1.5px solid #2d4060; border-radius:10px; padding:9px 14px 9px 10px; margin:6px 0; max-width:92%; vertical-align:top; cursor:pointer; -webkit-user-select:none; user-select:none; }
  .att-ic { font-size:22px; flex-shrink:0; line-height:1; }
  .att-body { display:flex; flex-direction:column; gap:3px; min-width:0; overflow:hidden; }
  .att-name { color:#E2E8F0; font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; max-width:220px; }
  .att-meta { color:#64748B; font-size:11px; white-space:nowrap; display:block; }
`;

// Injected once after editor initializes: height polling + media load detection + attachment click
export const EDITOR_INIT_JS = `
  (function(){
    var t=null;
    function ph(){
      var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'HEIGHT_CHANGE',height:h}));
    }
    function dp(){if(t)clearTimeout(t);t=setTimeout(ph,100);}

    function attachMedia(el){
      if(!el||el._mw)return;
      el._mw=true;
      var isImg=el.tagName==='IMG';
      var isVid=el.tagName==='VIDEO';
      var done=(isImg&&el.complete&&el.naturalWidth>0)||(isVid&&el.readyState>=4);
      if(!done&&isImg&&!el.getAttribute('height')){
        el.style.minHeight='240px';
      }
      function onMediaLoaded(){if(isImg)el.style.minHeight='';dp();}
      function onError(){if(isImg)el.style.minHeight='';dp();}
      if(done){
        setTimeout(dp,0);
      } else {
        el.addEventListener('load',onMediaLoaded,{once:true});
        el.addEventListener('loadedmetadata',onMediaLoaded,{once:true});
        el.addEventListener('error',onError,{once:true});
      }
    }

    function watchMedia(root){
      if(!root||!root.querySelectorAll)return;
      root.querySelectorAll('img,video').forEach(attachMedia);
    }

    watchMedia(document.body);
    ph();

    new MutationObserver(function(mutations){
      dp();
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1)return;
          if(n.tagName==='IMG'||n.tagName==='VIDEO'){
            attachMedia(n);
          } else {
            watchMedia(n);
          }
        });
      });
    }).observe(document.body,{childList:true,subtree:true,characterData:true});

    document.addEventListener('click',function(e){
      var chip=e.target.closest&&e.target.closest('.att-chip');
      if(chip&&chip.dataset&&chip.dataset.url){
        e.preventDefault();e.stopPropagation();
        window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'OPEN_ATTACHMENT',
          url:chip.dataset.url,
          name:chip.dataset.name||'',
          mime:chip.dataset.mime||''
        }));
      }
    },true);
  })();
  true;
`;
