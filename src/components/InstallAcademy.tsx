import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallAcademy() {
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [online, setOnline] = useState(navigator.onLine);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const change = () => setInstalled(media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => setInstalled(true);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('beforeinstallprompt', before); window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', update); window.addEventListener('offline', update); media.addEventListener('change', change);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', onInstalled); window.removeEventListener('online', update); window.removeEventListener('offline', update); media.removeEventListener('change', change); };
  }, []);
  return <div className="academy-install" role="status">
    {!online && <p><strong>Offline.</strong> Saved lessons and local notes are available in this session. Sign-in, Ask Ace, videos and official exams require internet.</p>}
    {!installed && <div><strong>Install DANIELLACODES</strong><p>Optional: add the academy to your home screen. Continue learning without installing.</p>{prompt ? <button className="btn outline sm" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Install app</button> : <small>Use your browser’s “Install app” or “Add to Home screen” menu.</small>}</div>}
  </div>;
}
