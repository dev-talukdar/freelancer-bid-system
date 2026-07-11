import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/fbs-test',
      LOCAL_API_SECRET: 'test-local-api-secret',
    },
  },
});
