import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F2DDCC",
        card: "#DFCCB1",
        line: "#C4A071",
        text: "#2F2418",
        muted: "#6A5139",
        accent: "#C4A071",
        success: "#2F8F5B"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(196,160,113,0.35), 0 12px 34px rgba(106,81,57,0.18)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 12% 12%, rgba(223,204,177,0.75), transparent 42%), radial-gradient(circle at 85% 2%, rgba(196,160,113,0.34), transparent 42%)"
      }
    }
  },
  plugins: []
};

export default config;
