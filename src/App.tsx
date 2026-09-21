import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import PartPage from "./pages/PartPage";
import TopicPage from "./pages/TopicPage";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/part/:partIndex" element={<PartPage />} />
      <Route
        path="/part/:partIndex/topic/:topicIndex"
        element={<TopicPage />}
      />
    </Routes>
  );
}

export default App;