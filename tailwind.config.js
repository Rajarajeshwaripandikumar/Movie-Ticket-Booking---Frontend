// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // ✅ Step 2: Add Proxima Nova globally
        sans: ['"Proxima Nova"', "sans-serif"],
      },
      colors: {
        primary: "#2F57EF",
        navy: "#1E2A78",
        blueLight: "#E8EEFF",
        accentPurple: "#7B61FF",
        accentGreen: "#00B884",
        accentYellow: "#FFC93C",
        grayText: "#9CA3AF",
        bgLight: "#F8FAFD",
      },
      boxShadow: {
        card: "0 4px 14px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
