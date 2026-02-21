import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--accent) / 0.35), 0 12px 34px rgb(var(--line) / 0.28)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 12% 12%, rgb(var(--mesh-a) / 0.75), transparent 42%), radial-gradient(circle at 85% 2%, rgb(var(--mesh-b) / 0.18), transparent 42%), linear-gradient(120deg, rgb(var(--bg) / 1), rgb(var(--card) / 0.86), rgb(var(--bg) / 1))",
        panel: "linear-gradient(145deg, rgb(var(--card) / 0.9), rgb(var(--bg) / 0.88) 52%, rgb(var(--line) / 0.26))"
      }
    }
  },
  plugins: []
};

export default config;
