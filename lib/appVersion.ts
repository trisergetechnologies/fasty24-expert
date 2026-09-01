import Constants from 'expo-constants';
import { Linking } from 'react-native';
import type { AppVersionConfig } from './api';

export function getInstalledVersionCode(): number {
  const native = Number(Constants.nativeBuildVersion);
  if (Number.isFinite(native) && native > 0) return native;
  const fromConfig = Number(Constants.expoConfig?.android?.versionCode);
  if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig;
  return 0;
}

export function needsForceUpdate(config: AppVersionConfig | null): boolean {
  if (!config?.forceUpdate) return false;
  if (!config.minVersionCode || config.minVersionCode <= 0) return false;
  const installed = getInstalledVersionCode();
  if (installed <= 0) return false;
  return installed < config.minVersionCode;
}

export async function openStore(config: AppVersionConfig) {
  const pkg = config.androidPackage || 'com.fasty24.expert';
  const market = `market://details?id=${pkg}`;
  const web =
    config.storeUrl || `https://play.google.com/store/apps/details?id=${pkg}`;
  try {
    const canMarket = await Linking.canOpenURL(market);
    await Linking.openURL(canMarket ? market : web);
  } catch {
    await Linking.openURL(web);
  }
}
