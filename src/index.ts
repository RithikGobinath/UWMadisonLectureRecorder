import { config } from "./config";
import { createApp } from "./server";

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Lecture recorder API listening on port ${config.port}`);
});
