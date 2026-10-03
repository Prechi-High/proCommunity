import { usePathname } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { BrandIntro } from '@/components/brand/BrandIntro';
import { markBrandIntroSeen, shouldPlayBrandIntro } from '@/lib/brand/introSession';

export function BrandIntroGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void shouldPlayBrandIntro(pathname).then((play) => {
      if (!cancelled) {
        setShow(play);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const finish = useCallback(() => {
    void markBrandIntroSeen();
    setShow(false);
  }, []);

  if (!ready) return <>{children}</>;

  return (
    <>
      {children}
      <BrandIntro visible={show} onDone={finish} />
    </>
  );
}
