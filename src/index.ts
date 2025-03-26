import { Bonfire } from "./lib";

// Example usage:
const app = new Bonfire();

// Middleware example
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Route examples
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params.id });
});

app.post("/users", (req, res) => {
  res.status(201).json({ created: req.body });
});

app.listen(3000);
