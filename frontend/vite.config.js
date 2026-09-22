import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Split vendor code into separate cacheable chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — changes rarely, long-term cached
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'vendor-radix': [
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-slot',
          ],
          // Heavy optional libs (PDF, CSV, charts)
          'vendor-export': ['jspdf', 'jspdf-autotable', 'papaparse'],
          // Sentry (only needed if DSN configured)
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Smaller chunks warning threshold
    chunkSizeWarningLimit: 600,
    // Minification
    minify: 'esbuild',
    // Source maps off for production speed
    sourcemap: false,
  },
}));

