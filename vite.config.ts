import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Remove type="module" from script tags so Apache shared hosting
// doesn't reject them with strict MIME type checking.
const removeModuleType: Plugin = {
  name: 'remove-module-type',
  transformIndexHtml(html: string) {
    return html.replace(/<script type="module"/g, '<script')
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeModuleType],
  base: '/dist/',
})
