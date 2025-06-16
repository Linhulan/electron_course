import { useState, useEffect, useMemo } from "react";
import "./App.css";
import { useStatistics } from "./useStatistics";
import { Chart } from "./Chart";

function App() {
  const [activeView, setActiveView] = useState("CPU");
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
      case "CPU":
        return cpuUsage;
      case "RAM":
        return ramUsages;
      case "STORAGE":
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
      <Header />
      <div className="main">
        <div className="mainGrid">
          <Chart data={activeUsage} maxDataPoints={10} />
        </div>
      </div>
    </>
  );
}

function Header() {
  return (
    <header>
      <button
        id="close"
        onClick={() => window.electron.sendFrameAction("CLOSE")}
      ></button>
      <button
        id="minimize"
        onClick={() => window.electron.sendFrameAction("MINIMIZE")}
      ></button>
      <button
        id="maximize"
        onClick={() => window.electron.sendFrameAction("MAXIMIZE")}
      ></button>
    </header>
  );
}

export default App;
