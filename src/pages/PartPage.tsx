import { useNavigate, useParams } from "react-router-dom";
import civilData from "../data/civil_outline_complete.json";

function PartPage() {
  const navigate = useNavigate();
  const { partIndex } = useParams();

  const index = Number(partIndex);
  const part = civilData.parts[index];

  if (!part) {
    return (
      <main className="app">
        <p>해당 목차를 찾을 수 없습니다.</p>

        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          홈으로
        </button>
      </main>
    );
  }

  return (
    <main className="app part-page">
      <button
        className="back-button"
        onClick={() => navigate("/")}
      >
        ← 민법
      </button>

      <header className="part-header">
        <span className="part-label">
          PART {index + 1}
        </span>

        <h1>{part.title}</h1>

        <p>총 {part.topics.length}개의 목차</p>
      </header>

      <section className="topic-list">
        {part.topics.map((topic, topicIndex) => (
          <button
            className="topic-card"
            key={`${topic.title}-${topicIndex}`}
            onClick={() =>
              navigate(`/part/${index}/topic/${topicIndex}`)
            }
          >
            <span className="topic-index">
              {String(topicIndex + 1).padStart(2, "0")}
            </span>

            <span className="topic-title">
              {topic.title}
            </span>

            <span className="topic-arrow">
              ›
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}

export default PartPage;