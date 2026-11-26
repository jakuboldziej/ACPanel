import { CarsPage } from "./CarsPage";

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1>AC Panel</h1>
        <nav>
          <span className="active">Cars</span>
        </nav>
      </header>
      <main>
        <CarsPage />
      </main>
    </div>
  );
}
