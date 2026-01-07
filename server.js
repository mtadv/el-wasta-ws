import "dotenv/config";
import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLYAI_API_KEY) {
  throw new Error("❌ Missing ASSEMBLYAI_API_KEY");
}

const app = express();

// ✅ Health check for Render
app.get("/", (req, res) => {
  res.send("El Wasta WS Server is running");
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

console.log("✅ WS server initialized");

wss.on("connection", (client) => {
  console.log("🔌 Browser connected");

  // 🔗 AssemblyAI Realtime
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

  // 🧠 Assembly → Browser
  assembly.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.text) {
      client.send(
        JSON.stringify({
          text: data.text,
          isFinal: data.message_type === "FinalTranscript",
        })
      );
    }
  });

  assembly.on("error", (err) => {
    console.error("❌ AssemblyAI WS error", err);
  });

  // 🎙️ Browser → Assembly
  client.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "audio") {
        assembly.send(
          JSON.stringify({
            audio_data: data.chunk,
          })
        );
      }

      if (data.type === "end") {
        assembly.send(JSON.stringify({ terminate_session: true }));
      }
    } catch (e) {
      console.error("❌ Invalid browser message", e);
    }
  });

  const cleanup = () => {
    console.log("❌ Client disconnected");

    if (assembly.readyState === WebSocket.OPEN) {
      assembly.close();
    }
  };

  client.on("close", cleanup);
  client.on("error", cleanup);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WS listening on port ${PORT}`);
});
