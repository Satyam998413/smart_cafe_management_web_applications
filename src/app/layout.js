import './globals.css';
import BackgroundEffect from '@/components/BackgroundEffect';

export const metadata = {
  title: 'Cremen Smart Spaces',
  description: 'Cremen Smart Spaces — order ahead, track your order, IoT space automation, and staff tools.'
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
