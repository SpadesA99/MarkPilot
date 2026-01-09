/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VS Code Dark Theme
        vscode: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          active: '#37373d',
          hover: '#2a2d2e',
          border: '#3c3c3c',
          text: '#cccccc',
          'text-bright': '#d4d4d4',
          'text-muted': '#858585',
          blue: '#007acc',
          'blue-light': '#0098ff',
          green: '#4ec9b0',
          yellow: '#dcdcaa',
          orange: '#ce9178',
          purple: '#c586c0',
          red: '#f14c4c',
        },
        // Keep old colors for compatibility
        primary: '#007acc',
        secondary: '#858585',
        bg: '#1e1e1e',
        'dark-bg': '#1e1e1e',
        'card-bg': '#252526',
        'dark-card-bg': '#252526',
      }
    },
  },
  plugins: [],
}
