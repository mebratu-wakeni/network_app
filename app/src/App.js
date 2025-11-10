const { Row } = Liteframe;
import { Card, ProfileCard } from "./components/Card.js";
import serverManagerUI from "./components/serverManager/serverManagerUI.js";

export function App() {
  return Row({ class: "App" }, [
    serverManagerUI(),
  ])
}