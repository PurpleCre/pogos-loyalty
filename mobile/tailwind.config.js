/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: We will likely be moving components to 'components' folder, and screens to 'app'
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
