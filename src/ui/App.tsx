import { useState } from "react";
import "./App.css";
import { SerialPortPanel } from "./SerialPortPanel";
import { CounterDashboard } from "./CounterDashboard";
import { Sidebar, PageType } from "./Sidebar";

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('serial-port');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'serial-port':
        return <SerialPortPanel className="page-content" />;
      case 'counter-dashboard':
        return <CounterDashboard className="page-content" />;
      default:
        return <SerialPortPanel className="page-content" />;
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'serial-port':
        return 'Serial Port Monitor';
      case 'counter-dashboard':
        return 'Money Counter Dashboard';
      default:
        return 'Serial Port Monitor';
    }
  };

  return (
    <>
      <Header title={getPageTitle()} />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        <main className="main-content">
          {renderCurrentPage()}
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
