import { lazy, Suspense, useEffect, useState } from 'react';
import { AccessGate, lockSiteAccess } from './components/AccessGate';
import { stopSpeaking } from './hooks/tts';
import { Landing } from './screens/Landing';

const DemoShell = lazy(() => import('./screens/DemoShell').then((m) => ({ default: m.DemoShell })));
const FamilyEntry = lazy(() => import('./screens/FamilyEntry').then((m) => ({ default: m.FamilyEntry })));

type Route = 'landing' | 'demo' | 'family';

function parseRoute(hash: string): Route {
  if (hash.startsWith('#/demo')) return 'demo';
  if (hash.startsWith('#/family')) return 'family';
  return 'landing';
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  return (
    <AccessGate>
      <a className="skip" href="#main">דלג לתוכן</a>
      <nav className="topnav" aria-label="ראשי">
        <a href="#/" className="brand">
          <img src="/favicon.svg" width="32" height="32" alt="" /> שוק הכיס
        </a>
        <div className="topnav__links">
          <a href="#/demo" aria-current={route === 'demo' ? 'page' : undefined}>דמו</a>
          <a href="#/family" aria-current={route === 'family' ? 'page' : undefined}>המשפחה שלי</a>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            title="נעילת האתר ויציאה"
            onClick={() => {
              stopSpeaking();
              lockSiteAccess();
              window.location.reload();
            }}
          >
            🔒 נעילה
          </button>
        </div>
      </nav>
      <div className="page" id={route === 'landing' ? 'main' : undefined}>
        <Suspense fallback={<p className="loading">טוען… 🌱</p>}>
          {route === 'landing' && <Landing />}
          {route === 'demo' && <DemoShell />}
          {route === 'family' && <FamilyEntry />}
        </Suspense>
      </div>
    </AccessGate>
  );
}

