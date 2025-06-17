import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import "./App.css";
import { SerialPortPanel } from "./SerialPortPanel";
import { CounterDashboard } from "./CounterDashboard";
import { Sidebar, PageType } from "./Sidebar";

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('serial-port');
  const { t } = useTranslation();

  const handlePageChange = (newPage: PageType) => {
    setCurrentPage(newPage);
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'serial-port':
        return t('serialPort.title');
      case 'counter-dashboard':
        return t('counter.title');
      default:
        return t('app.title');
    }
  };

  return (
    <>
      <Header title={getPageTitle()} />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />
        <main className="main-content">
          <div className={`page-container ${currentPage === 'serial-port' ? 'active' : 'hidden'}`}>
            <SerialPortPanel className="page-content" />
          </div>
          <div className={`page-container ${currentPage === 'counter-dashboard' ? 'active' : 'hidden'}`}>
            <CounterDashboard className="page-content" />
          </div>
        </main>
      </div>
    </>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header>
      <div className="header-left">
        <span className="app-title">{title}</span>
      </div>
      <div className="header-right">
        <LanguageSwitcher compact className="header-language-switcher" />
        <button
          id="minimize"
          onClick={() => window.electron.sendFrameAction("MINIMIZE")}
        ></button>
        <button
          id="maximize"
          onClick={() => window.electron.sendFrameAction("MAXIMIZE")}
        ></button>
        <button
          id="close"
          onClick={() => window.electron.sendFrameAction("CLOSE")}
        ></button>
      </div>
    </header>
  );
}

export default App;
