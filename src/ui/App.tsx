import { useState, useEffect, useMemo } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";
import { useStatistics } from "./useStatistics";
import { Chart } from "./Chart";

function App() {
  const [count, setCount] = useState(0);
  const [activeView, setActiveView] = useState('CPU');
  const statistics = useStatistics(10);
  const cpuUsage = useMemo(
    () => statistics.map((s) => s.cpuUsage),
    [statistics]
  );
  const ramUsages = useMemo(
    () => statistics.map((s) => s.ramUsage),
    [statistics]
  );
  const storageUsages = useMemo(
    () => statistics.map((s) => s.storageUsage),
    [statistics]
  );
  const activeUsage = useMemo(() => {
    switch (activeView) {
      case 'CPU':
        return cpuUsage;
      case 'RAM':
        return ramUsages;
      case 'STORAGE':
        return storageUsages;
      default:
        return [];
    }
  }, [activeView, cpuUsage, ramUsages, storageUsages]);

  useEffect(() => {
    return window.electron.subscribeChangeView((view) => setActiveView(view));
  }, []);

  return (
    <>
      <div style={{ height: 120 }}>
        <Chart data={activeUsage} maxDataPoints={10} />
      </div>
      <div>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
