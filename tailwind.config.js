/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false, // Desabilita reset do Tailwind para não conflitar com Ant Design
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
