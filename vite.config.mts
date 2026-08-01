import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Fonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Fonts({
      fontsource: {
        families: [
          {
            name: 'Roboto',
            weights: [100, 300, 400, 500, 700, 900],
            styles: ['normal', 'italic'],
          },
        ],
      },
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    // Same-origin /api, rather than the browser calling localhost:8080 across
    // origins. Not a convenience: the PHP session cookie is SameSite=Strict, so
    // a cross-origin request never carries it and anything behind a login fails
    // in the browser while working perfectly from curl. Proxying keeps the
    // browser on one origin and sidesteps CORS entirely.
    proxy: {
      '/api': {
        // The dev server runs in a container, where localhost is *this*
        // container rather than the machine - the PHP app is reached the same
        // way everything else reaches it, on host.docker.internal. Override
        // with API_PROXY_TARGET when running `npm run dev` directly on the
        // host, where that name does not resolve:
        //
        //   API_PROXY_TARGET=http://localhost:8080 npm run dev
        target: process.env.API_PROXY_TARGET || 'http://host.docker.internal:8080',
        // the API is matched on its own paths, so the Host header is left alone
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
  },
})
