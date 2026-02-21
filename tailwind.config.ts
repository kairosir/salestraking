import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020b14",
        card: "#071728",
        line: "#17314a",
        text: "#d5e6f8",
        muted: "#7f9db9",
        accent: "#0ea5e9",
        success: "#10b981"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(14,165,233,0.25), 0 12px 40px rgba(14,165,233,0.2)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 40%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.14), transparent 35%)"
      }
    }
  },
  plugins: []
};

export default config;
