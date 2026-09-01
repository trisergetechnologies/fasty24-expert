import { Alert, InteractionManager, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickImageResult =
  | { uri: string }
  | { reason: 'denied' | 'canceled' };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIdle() {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await delay(Platform.OS === 'android' ? 450 : 50);
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  if (asked.granted) return true;
  Alert.alert(
    'Camera permission required',
    'Allow camera access in Settings so you can take KYC and job photos.',
    [
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
  return false;
}

async function launchCamera(cameraType?: 'front' | 'back') {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  };
  // cameraType:front immediately closes the camera on several Android OEMs.
  if (Platform.OS === 'ios' && cameraType) {
    options.cameraType =
      cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back;
  }
  return ImagePicker.launchCameraAsync(options);
}

async function launchLibrary() {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  };
  try {
    return await ImagePicker.launchImageLibraryAsync(options);
  } catch {
    // Some Android 13/14 devices need the legacy picker.
    return ImagePicker.launchImageLibraryAsync({ ...options, legacy: true });
  }
}

export async function pickImage(opts: {
  mode: 'camera' | 'library';
  cameraType?: 'front' | 'back';
}): Promise<PickImageResult> {
  try {
    if (opts.mode === 'camera') {
      const ok = await ensureCameraPermission();
      if (!ok) return { reason: 'denied' };
    }
    // Do not request photo-library permission on Android 13+: the system Photo
    // Picker does not need it, and a denied request blocks the gallery entirely.

    await waitForIdle();

    const result = opts.mode === 'camera' ? await launchCamera(opts.cameraType) : await launchLibrary();
    if (result.canceled || !result.assets?.[0]?.uri) return { reason: 'canceled' };
    return { uri: result.assets[0].uri };
  } catch (err: any) {
    Alert.alert(
      opts.mode === 'camera' ? 'Could not open camera' : 'Could not open gallery',
      err?.message ?? 'Please try again. If this keeps happening, reinstall the latest preview build.',
    );
    return { reason: 'canceled' };
  }
}
