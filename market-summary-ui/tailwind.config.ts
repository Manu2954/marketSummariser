import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#0b0d10',
        fog: '#f2f4f8',
        slate: '#c4ccd9',
        steel: '#4a5363',
        ocean: '#0a6b75',
        coral: '#f26b4f',
        mint: '#2bbf98',
      },
      boxShadow: {
        soft: '0 20px 60px -40px rgba(15, 23, 42, 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
