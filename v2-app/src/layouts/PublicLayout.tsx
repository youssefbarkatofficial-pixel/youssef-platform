import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/layout/PublicHeader';
import Footer from '../components/layout/Footer';

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
