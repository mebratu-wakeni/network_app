const { Row } = Liteframe;
import { Card, ProfileCard } from "./components/Card.js";

export function App() {
  return Row({ class: "bg-gray-50 dark:bg-gray-800 rounded-lg p-6" }, [
    Card(),
    ProfileCard()
  ])
}