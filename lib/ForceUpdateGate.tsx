import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getAppConfig, type AppVersionConfig } from './api';
import { needsForceUpdate } from './appVersion';
import ForceUpdateModal from '../components/ForceUpdateModal';

export default function ForceUpdateGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppVersionConfig | null>(null);

  const check = useCallback(async () => {
    try {
      const next = await getAppConfig('expert');
      setConfig(next);
    } catch {
      // Stay usable if the version check cannot reach the server.
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const blocked = needsForceUpdate(config);

  return (
    <>
      {children}
      <ForceUpdateModal visible={blocked} config={config} />
    </>
  );
}
