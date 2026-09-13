import './globals.css';
import BackgroundEffect from '@/components/BackgroundEffect';

export const metadata = {
  title: 'Smart Cafe Manager',
  description: 'Smart Cafe Manager — order ahead, track your order, and staff tools.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BackgroundEffect />
        {children}
      </body>
    </html>
  );
}
