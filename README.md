<div align="center">
  <br />
    <a href="https://github.com/sanketghosh/bonfire" target="_blank">
      <img src="https://github.com/sanketghosh/bonfire/blob/main/public/bonfire.png" alt="Project Banner">
    </a>
  <br />
</div>

# Bonfire: A Minimal JavaScript Backend Framework

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Maintenance](https://img.shields.io/badge/Maintained-Yes-green.svg)](https://github.com/YOUR_GITHUB_USERNAME/bonfire/graphs/commit-activity)

**Bonfire is a minimal JavaScript backend framework built for ease of use.** It provides the essential tools and structure you need to quickly build robust and efficient backend applications with JavaScript, without unnecessary complexity.

## Key Features

- **Minimal Core:** Focuses on the fundamental building blocks of a backend framework.
- **Intuitive Routing:** Simple and straightforward way to define API endpoints.
- **Lightweight Middleware:** Easily implement request and response processing logic.
- **Basic Request & Response Handling:** Abstracts away the complexities of Node.js's `http` module.
- **Developer-Friendly:** Designed with simplicity and ease of understanding in mind.

## Getting Started

### Installation

```bash
npm install bonfire-framework  # Replace with your actual package name if different
# or
yarn add bonfire-framework
```

### Basic Usage

```ts
// Define a route
app.get("/", (req, res) => {
  res.send("Hello from Bonfire!");
});

app.post("/api/users", (req, res) => {
  const { name, email } = req.body;
  // Process user data
  res.json({ message: "User created successfully", user: { name, email } });
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Bonfire server listening on port ${port}`);
});
```
