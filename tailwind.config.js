/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sunset-orange': '#ff7f50',
        'golden-yellow': '#daa520',
        'sage-green': '#87a96b',
        'forest-green': '#2d5016',
        'terracotta': '#cd853f',
        'warm-brown': '#8b4513',
        'cream': '#f5f5dc',
      }
    },
    fontFamily: {
      'poppins': ['Poppins', 'sans-serif'],
    }
  },
  plugins: [],
}