import animate from 'tailwindcss-animate';
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        // Notevia brand palette
        lavender: { DEFAULT: '#7C6FD1', deep: '#6D60C2', ink: '#4B3F9E' },
        lilac: '#E4DDFB', sage: '#D5ECE3', dusty: '#F9D9E6', powder: '#D6E7F8', peach: '#FDE3D6', butter: '#FBF0C7', ivory: '#F8F6FC',
        charcoal: '#2F2B45', slate2: '#7B7692',
      },
      fontFamily: { sans: ['ui-rounded', '"SF Pro Rounded"', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'] },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)', xl: '1rem', '2xl': '1.25rem', '3xl': '1.5rem' },
      boxShadow: { soft: '0 1px 2px rgba(60,50,110,.05), 0 8px 24px rgba(60,50,110,.06)', lift: '0 10px 34px rgba(47,43,69,.12)' },
      keyframes: {
        'accordion-down': { from: { height: 0 }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: 0 } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: { 'accordion-down': 'accordion-down .2s ease-out', 'accordion-up': 'accordion-up .2s ease-out', 'fade-up': 'fade-up .25s ease-out both' },
    },
  },
  plugins: [animate],
};
