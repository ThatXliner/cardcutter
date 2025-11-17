import { mount } from "svelte";
import App from "./App.svelte";
// import "./app.css"; // Reuse Tailwind CSS

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
