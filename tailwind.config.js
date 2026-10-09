/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./main.js"],
    theme: {
        extend: {
            colors: {
                'blue': '#415A77',
                'purple': '#778DA9',
                'pink': '#ff49db',
                'orange': '#ff7849',
                'green': '#13ce66',
                'yellow': '#ffc82c',
                'gray-dark': '#0D1B2A',
                'gray': '#1B263B',
                'gray-light': '#E0E1DD',
            },
            fontFamily: {
                sans: ['Montserrat', 'sans-serif'],
                display: ['Quicksand', 'sans-serif'],
            },
        }
    }
}
