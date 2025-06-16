import "./App.css";
import { SerialPortPanel } from "./SerialPortPanel";

function App() {
  return (
    <>
      <Header />
      <div className="main">
        <SerialPortPanel className="serial-port-container" />
      </div>
    </>
  );
}

function Header() {
  return (
    <header>
      <div className="header-left">
        <span className="app-title">Serial Port Monitor</span>
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
