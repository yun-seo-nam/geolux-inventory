import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Nav, Button } from 'react-bootstrap';
import { FiSun, FiMoon } from 'react-icons/fi';
import { FaTable } from "react-icons/fa6";
import { RxDashboard } from 'react-icons/rx';
import { MdOutlineBuild } from 'react-icons/md';
import { PiGear } from 'react-icons/pi';
import { RiTableView } from "react-icons/ri";

function useColorMode() {
  const getInitial = () => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };
  const [mode, setMode] = useState(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', mode);
    localStorage.setItem('theme', mode);
  }, [mode]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      const saved = localStorage.getItem('theme');
      if (!saved) setMode(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const toggle = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));
  return { mode, toggle };
}

const Layout = () => {
  const location = useLocation();
  const { mode, toggle } = useColorMode();
  const items = useMemo(
    () => [
      { to: '/partList', icon: <PiGear />, label: 'Parts', active: location.pathname.startsWith('/part') || location.pathname === '/' },
      { to: '/buildList', icon: <MdOutlineBuild />, label: 'PCB', active: location.pathname.startsWith('/build') },
      { to: '/project', icon: <RxDashboard />, label: 'Dashboard', active: location.pathname === '/project' },
      { to: '/overView', icon: <RiTableView />, label: 'Overview', active: location.pathname === '/overView' },
      { to: '/aliasName', icon: <FaTable />, label: 'Rep. / Alt. Parts', active: location.pathname === '/aliasName' },
    ],
    [location.pathname]
  );

  return (
    <div className="layout-root">
      {/* 헤더 */}
      <header className="layout-header">
        <div className="d-flex flex-row align-items-center gap-5">
          <Link to="/" className="brand-link" aria-label="Go home">
            <h4 className="brand-title mb-0 ms-5">GeoluxStock</h4>
          </Link>
          <Nav className="flex-row p-3 gap-2 mt-2">
            {items.map((it) => (
              <Nav.Link
                key={it.to}
                as={Link}
                to={it.to}
                className={`sidebar-link ${it.active ? 'active' : ''}`}
                aria-current={it.active ? 'page' : undefined}
              >
                <span className="sidebar-icon">{it.icon}</span>
                <span className="sidebar-label">{it.label}</span>
              </Nav.Link>
            ))}
          </Nav>
        </div>
        <div className="header-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 테마 토글 */}
          <Button
            variant="outline-light"
            size="sm"
            className="theme-toggle-btn"
            onClick={toggle}
            aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            title={mode === 'light' ? '다크 모드' : '라이트 모드'}
          >
            {mode === 'light' ? <FiMoon /> : <FiSun />}
          </Button>

        </div>
      </header>

      {/* 본문 */}
      <main className="layout-main">
        <div className="main-content-wrapper">
          <Outlet />
        </div>
      </main>

      {/* 푸터 */}
      <footer className="layout-footer">
        <div className="text-center small p-1">
          <p className="mt-2">㈜지오룩스 | 대표 : 이희순 | 서울특별시 송파구 문정로 19, 프라도 빌딩 306호 (문정동 39-1)</p>
          <p>대표전화 : 02-497-3308 | FAX : 02-497-3309 | E-MAIL : info@geolux.co.kr</p>
          <p>COPYRIGHT ⓒ ㈜지오룩스 All Rights Reserved</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
