import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // ColorBrewer RdBu diverging palette for political spectrum
        political: {
          left: '#2166AC',
          'left-center': '#67A9CF',
          center: '#F7F7F7',
          'right-center': '#EF8A62',
          right: '#B2182B',
          // Accessible text colors for each background
          'left-text': '#FFFFFF',
          'left-center-text': '#1E3A5F',
          'center-text': '#374151',
          'right-center-text': '#7C2D12',
          'right-text': '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};

export default config;
