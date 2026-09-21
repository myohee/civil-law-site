import { useNavigate } from "react-router-dom";
import civilData from "../data/civil_outline_complete.json";
import BackupControls from "../components/BackupControls";

function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="app">

      <header className="header">
        <h1>민법</h1>
      </header>

      <BackupControls />

      <section className="part-list">

        {civilData.parts.map(
          (part, index) => (

            <button
              className="part-card"
              key={part.title}
              onClick={() =>
                navigate(
                  `/part/${index}`
                )
              }
            >

              <span className="part-number">
                PART {index + 1}
              </span>

              <h2>
                {part.title}
              </h2>

              <p>
                {part.topics.length}개 목차
              </p>

            </button>

          )
        )}
      </section>

    </main>
  );
}

export default HomePage;