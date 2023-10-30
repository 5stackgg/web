/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
    "node_modules/preline/dist/*.js",
  ],
  theme: {
    // colors: {
    //   'red': '#F4645F',
    //   'blue': '#48ACF0',
    //   'purple': '#A46FAE',
    //   'green': '#83B692',
    //   'yellow': '#FEC07A',
    //   // 'gray-dark': '#2B2B2B',
    //   // 'gray': '#3C3F41',
    //   // 'gray-light': '#d3dce6',
    // },
    fontFamily: {
      sans: ["Graphik", "sans-serif"],
      serif: ["Merriweather", "serif"],
    },
    extend: {},
  },
  plugins: [require("@tailwindcss/forms"), require("preline/plugin")],
};
