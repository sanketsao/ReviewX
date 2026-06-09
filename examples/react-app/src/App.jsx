import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <main className="app">
      <header className="hero" id="hero">
        <h1 id="title">TaskFlow</h1>
        <p className="tagline">A tiny React prototype for review.</p>
      </header>

      <section className="counter-card" id="counter">
        <h2>Interactive counter</h2>
        <button id="inc" className="btn" onClick={() => setCount((c) => c + 1)}>
          Clicked {count} times
        </button>
        <p className="hint">Used to prove React state survives the overlay proxy.</p>
      </section>

      <section className="features" id="features">
        <div className="feature" id="feat-boards">
          <h3>Boards</h3>
          <p>Drag-and-drop columns for every workflow.</p>
        </div>
        <div className="feature" id="feat-automation">
          <h3>Automation</h3>
          <p>Rules that move cards so you don't have to.</p>
        </div>
        <div className="feature" id="feat-reports">
          <h3>Reports</h3>
          <p>See throughput and cycle time at a glance.</p>
        </div>
      </section>
    </main>
  );
}
