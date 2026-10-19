import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopTicker from '../components/layout/TopTicker';
import PublicHeader from '../components/layout/PublicHeader';
import Footer from '../components/layout/Footer';
import BousalaChatDrawer from '../components/student/BousalaChatDrawer';
import { getPlatformMediaSettings } from '../services/settings';
import type { PlatformMediaSettings } from '../services/settings';

export default function PublicLayout() {
  const [media, setMedia] = useState<PlatformMediaSettings | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    let active = true;
    void getPlatformMediaSettings().then((res) => {
      if (active) setMedia(res);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <TopTicker quotes={media?.tickerQuotes} />
      <PublicHeader logoUrl={media?.logoUrl} />
      <main className="flex-1 animate-in fade-in duration-300">
        <Outlet context={{ media }} />
      </main>
      <Footer logoUrl={media?.logoUrl} />
      {/* Bousala Chat Drawer available on all public pages */}
      <BousalaChatDrawer />
    </div>
  );
}
