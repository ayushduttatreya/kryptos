import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@testing-library/react': path.resolve('./node_modules/@testing-library/react'),
      '@testing-library/jest-dom': path.resolve('./node_modules/@testing-library/jest-dom'),
      '@testing-library/user-event': path.resolve('./node_modules/@testing-library/user-event'),
      'react-qr-reader': path.resolve('./node_modules/react-qr-reader'),
      'qrcode.react': path.resolve('./node_modules/qrcode.react'),
      'vitest': path.resolve('./node_modules/vitest'),
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      'lucide-react': path.resolve('./node_modules/lucide-react'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
    globals: true,
    include: ['../tests/frontend/**/*.{test,spec}.{js,jsx}', 'src/**/*.{test,spec}.{js,jsx}'],
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
})
