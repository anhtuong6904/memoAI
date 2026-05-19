import { RefObject, useCallback, useEffect, useRef, useState } from "react";

export function useEditorHeight(richRef: RefObject<any>) {
  const [scrollViewH, setScrollViewH] = useState(0);
  const [topAreaH, setTopAreaH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const pollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const editorFloor =
    scrollViewH > 0 && topAreaH > 0
      ? Math.max(300, scrollViewH - topAreaH - 1)
      : 300;
  const editorHeight = Math.max(editorFloor, contentH + 32);

  const pollHeight = useCallback(() => {
    [100, 500, 1500, 4000].forEach((ms) => {
      const t = setTimeout(() => {
        richRef.current?.commandDOM(
          `(function(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'HEIGHT_CHANGE',height:h}));})();`,
        );
      }, ms);
      pollTimers.current.push(t);
    });
  }, [richRef]);

  useEffect(() => () => { pollTimers.current.forEach(clearTimeout); }, []);

  return { setScrollViewH, setTopAreaH, setContentH, editorHeight, pollHeight };
}
