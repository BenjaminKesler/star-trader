import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/star-trader/' : '/',
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
}));
