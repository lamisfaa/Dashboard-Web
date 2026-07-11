import React, { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScriptPromise;

function loadTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileScriptPromise) {
      turnstileScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
        if (existingScript) {
          existingScript.addEventListener('load', () => {
            window.turnstile?.ready(() => resolve(window.turnstile));
          }, { once: true });
          existingScript.addEventListener('error', reject, { once: true });
          return;
        }

      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.turnstile?.ready(() => resolve(window.turnstile));
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return turnstileScriptPromise;
}

export default function TurnstileWidget({ action, resetKey, onTokenChange }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
  const isTurnstileEnabled = import.meta.env.VITE_TURNSTILE_ENABLED === 'true'
    && import.meta.env.VITE_TURNSTILE_REQUIRED === 'true'
    && Boolean(siteKey)
    && !siteKey.startsWith('your_');

  useEffect(() => {
    let cancelled = false;
    onTokenChange('');

    if (!isTurnstileEnabled) {
      setLoadError('');
      return undefined;
    }

    setLoadError('');
    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || !turnstile) return;

        if (widgetIdRef.current) {
          turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          callback: (token) => onTokenChange(token),
          'expired-callback': () => onTokenChange(''),
          'error-callback': () => onTokenChange(''),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load CAPTCHA. Please refresh and try again.');
        }
      });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, isTurnstileEnabled, onTokenChange, resetKey, siteKey]);

  if (!isTurnstileEnabled) {
    return null;
  }

  return (
    <div className="auth-turnstile">
      <div ref={containerRef} />
      {loadError && <div className="auth-error">{loadError}</div>}
    </div>
  );
}
