import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────
// API Base URL Resolution
// ─────────────────────────────────────────────────────────────────────────

function resolveBase() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://localhost:8000/api';
}

export const API_BASE = resolveBase();

const TOKEN_KEY = 'ielts_daily_auth_token';

/**
 * Token management
 */
export const auth = {
  async setToken(token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async getToken() {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },
  async clearToken() {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  async login(email, password) {
    // OAuth2PasswordRequestForm expects form data
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    await this.setToken(data.access_token);
    return data;
  },
  async register(email, password) {
    return await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false); // don't require auth for register
  },
  async logout() {
    await this.clearToken();
  }
};

/**
 * Central fetch wrapper with unified error handling and auth injection.
 */
export async function apiFetch(path, options = {}, requireAuth = true) {
  const url = `${API_BASE}${path}`;
  console.log(`[API REQUEST] ${options.method || 'GET'} ${url}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const headers = {
      ...(options.headers || {}),
    };
    
    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    if (requireAuth) {
      const token = await auth.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const fetchOptions = {
      ...options,
      headers,
      signal: controller.signal,
    };

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (response.status === 401 && requireAuth) {
      await auth.clearToken();
      throw new Error('Unauthorized - please login again');
    }

    if (!response.ok) {
      let errorMessage = `Error ${response.status}`;
      try {
        const errorBody = await response.json();
        if (response.status === 422 && Array.isArray(errorBody.detail)) {
          errorMessage = errorBody.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join('\n');
        } else {
          errorMessage = errorBody.detail || JSON.stringify(errorBody);
        }
      } catch (_) {
        try {
          const textBody = await response.text();
          if (textBody) errorMessage = textBody.substring(0, 100);
        } catch (__) {}
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) return null;
    
    const contentType = response.headers.get ? response.headers.get('content-type') : response.headers['content-type'];
    if (contentType && contentType.toLowerCase().includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds');
    }
    console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, err.message);
    throw err;
  }
}
