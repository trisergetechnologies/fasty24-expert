import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'fasty_expert_token';
const USER_KEY = 'fasty_expert_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getUser<T = unknown>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setUser(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function removeUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
