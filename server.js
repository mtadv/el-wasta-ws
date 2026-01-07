import "dotenv/config";
import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLYAI_API_KEY) {
  throw new Error("❌ Missing ASSEMBLYAI_API_KEY");
}

const app = express();

app.get("/", (req, res) => {
  res.send("El Wasta WS Server is running");
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

console.log("✅ WS server initialized");

wss.on("connection", (client) => {
  console.log("🔌 Browser connected");

  const assembly = new WebSocket(
    "wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&speech_model=universal-streaming-multilingual",
    {
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    }
  );
  
  

  assembly.on("open", () => {
    console.log("🧠 AssemblyAI connected");

    // ✅ REQUIRED START MESSAGE
    assembly.send(
      JSON.stringify({
        sample_rate: 16000,
        format: "pcm_s16le",
      })
    );
  });

  assembly.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.error) {
      console.error("❌ AssemblyAI error:", data.error);
      return;
    }

    if (data.text) {
      client.send(
        JSON.stringify({
          text: data.text,
          isFinal: data.message_type === "FinalTranscript",
        })
      );
    }
  });

  client.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (
        data.type === "audio" &&
        data.chunk &&
        assembly.readyState === WebSocket.OPEN
      ) {
        assembly.send(
          JSON.stringify({
            audio_data: data.chunk,
          })
        );
      }
    } catch (e) {
      console.error("❌ Bad browser message", e);
    }
  });

  const cleanup = () => {
    console.log("❌ Client disconnected");

    if (assembly.readyState === WebSocket.OPEN) {
      assembly.send(JSON.stringify({ terminate_session: true }));
      assembly.close();
    }
  };

  client.on("close", cleanup);
  client.on("error", cleanup);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 WS server listening on ${PORT}`);
});
