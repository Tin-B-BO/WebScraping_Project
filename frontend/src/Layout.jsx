import Header from "./components/Header";
import Footer from "./components/Footer";
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div className="app-layout">
      <div className="app-header-shell">
        <Header />
      </div>
      <main className="app-main">
        <Outlet />
      </main>
      <div className="app-footer-shell">
        <Footer />
      </div>
    </div>
  );
}

export default Layout;
