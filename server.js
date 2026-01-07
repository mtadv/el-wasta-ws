import "dotenv/config";
import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLYAI_API_KEY) {
  throw new Error("❌ Missing ASSEMBLYAI_API_KEY");
}

const app = express();

// Health check (important for Render)
app.get("/", (req, res) => {
  res.send("El Wasta WS Server is running");
});

const server = http.createServer(app);

// Attach WebSocket to SAME server (Render requirement)
const wss = new WebSocketServer({ server });

console.log("✅ WS server initialized");

wss.on("connection", (client) => {
  console.log("🔌 Client connected");

  // Connect to AssemblyAI Realtime
  const assembly = new WebSocket(
    "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000",
    {
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    }
  );

  assembly.on("open", () => {
    console.log("🧠 AssemblyAI realtime connected");
  });

  assembly.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    // Partial + Final transcripts
    if (data.text) {
      client.send(
        JSON.stringify({
          type: "transcript",
          text: data.text,
          isFinal: data.message_type === "FinalTranscript",
        })
      );
    }
  });

  assembly.on("error", (err) => {
    console.error("❌ AssemblyAI WS error", err);
  });

  client.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // Incoming audio chunk from browser
      if (data.type === "audio" && data.chunk) {
        assembly.send(
          JSON.stringify({
            audio_data: data.chunk, // base64 PCM
          })
        );
      }
    } catch (e) {
      console.error("❌ Invalid WS message", e);
    }
  });

  client.on("close", () => {
    console.log("❌ Client disconnected");
    assembly.close();
  });

  client.on("error", (err) => {
    console.error("❌ Client WS error", err);
    assembly.close();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WS listening on port ${PORT}`);
});
