import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function GoogleAnalytics({ activeTab }: { activeTab: string }) {
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!measurementId) return;

    // Initialisation du script gtag s'il n'est pas déjà présent
    if (!document.getElementById('google-analytics')) {
      const script = document.createElement('script');
      script.id = 'google-analytics';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      window.gtag('js', new Date());
    }

    // Déclencher un page_view à chaque changement d'onglet
    if (window.gtag) {
      window.gtag('config', measurementId, {
        page_path: `/${activeTab}`,
      });
    }
  }, [activeTab]);

  return null;
}
