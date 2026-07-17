const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is required');
}

export const extensionConfig = { apiBaseUrl } as const;
