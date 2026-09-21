/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        /*
          The top bar.

          The sidebar's brand block and the page header sit side by side and
          each draws its own bottom border, so they have to be exactly as tall
          as each other or the line across the top of the app steps down at the
          sidebar edge. They were 89px and 85px, because one was sized by `p-6`
          around a 40px logo and the other by `py-4` around a 32px avatar — two
          heights nobody chose, derived from unrelated content.

          Named once here and applied to both. Changing the logo or the avatar
          can no longer move either of them.
        */
        topbar: '88px',
      },
    },
  },
  plugins: [],
};
