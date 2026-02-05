/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'bokeh': 'bokeh 20s infinite linear',
                'bokeh-reverse': 'bokeh-reverse 30s infinite linear',
                'grain': 'grain 8s steps(10) infinite',
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'wander': 'wander 40s ease-in-out infinite',
                'drift': 'drift 60s linear infinite',
            },
            keyframes: {
                wander: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(10vw, 15vh) scale(1.2) rotate(90deg)' },
                    '50%': { transform: 'translate(-5vw, 25vh) scale(0.8) rotate(180deg)' },
                    '75%': { transform: 'translate(-15vw, 5vh) scale(1.1) rotate(270deg)' },
                },
                drift: {
                    '0%': { transform: 'translateX(-20vw) translateY(-10vh) rotate(0deg)' },
                    '100%': { transform: 'translateX(120vw) translateY(110vh) rotate(360deg)' },
                },
                bokeh: {
                    '0%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0, 0) scale(1)' },
                },
                'bokeh-reverse': {
                    '0%': { transform: 'translate(0, 0) rotate(0deg)' },
                    '33%': { transform: 'translate(-40px, 60px) rotate(120deg)' },
                    '66%': { transform: 'translate(50px, -30px) rotate(240deg)' },
                    '100%': { transform: 'translate(0, 0) rotate(360deg)' },
                },
                grain: {
                    '0%, 100%': { transform: 'translate(0,0)' },
                    '10%': { transform: 'translate(-5%,-10%)' },
                    '20%': { transform: 'translate(-15%,5%)' },
                    '30%': { transform: 'translate(7%,-25%)' },
                    '40%': { transform: 'translate(-5%,25%)' },
                    '50%': { transform: 'translate(-15%,10%)' },
                    '60%': { transform: 'translate(15%,0%)' },
                    '70%': { transform: 'translate(0%,15%)' },
                    '80%': { transform: 'translate(3%,35%)' },
                    '90%': { transform: 'translate(-10%,10%)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                }
            },
        },
    },
    plugins: [],
}
