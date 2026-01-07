import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLYAI_API_KEY) {
  throw new Error("❌ Missing ASSEMBLYAI_API_KEY");
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("El Wasta WS Server is running");
});

const wss = new WebSocketServer({ server });

console.log("✅ WS server initialized");
