export function HydrationFix() {
  const script = `
    (function() {
      // Remove browser extension attributes before React hydration
      var body = document.body;
      if (body) {
        body.removeAttribute('cz-shortcut-listen');
        body.removeAttribute('data-gr-ext-installed');
        body.removeAttribute('data-new-gr-c-s-check-loaded');
        body.removeAttribute('vsc-initialized');
      }

      // Prevent extensions from re-adding attributes during hydration
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes') {
            var attr = mutation.attributeName;
            if (attr === 'cz-shortcut-listen' ||
                attr === 'data-gr-ext-installed' ||
                attr === 'data-new-gr-c-s-check-loaded' ||
                attr === 'vsc-initialized') {
              mutation.target.removeAttribute(attr);
            }
          }
        });
      });

      observer.observe(document.body, { attributes: true });

      // Disconnect observer after hydration completes (2 seconds)
      setTimeout(function() {
        observer.disconnect();
      }, 2000);
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />
}
