import "dotenv/config";
import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import { spawn } from "child_process";

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

  // 🔗 Connect to AssemblyAI Realtime
  const assembly = new WebSocket(
    "wss://api.assemblyai.com/v2/realtime/ws",
    {
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    }
  );

  let ffmpeg;

  assembly.on("open", () => {
    console.log("🧠 AssemblyAI realtime connected");

    // ✅ REQUIRED start message
    assembly.send(
      JSON.stringify({
        sample_rate: 16000,
      })
    );

    // 🎛️ FFmpeg: Opus/WebM → PCM16
    ffmpeg = spawn("ffmpeg", [
      "-loglevel",
      "quiet",
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-acodec",
      "pcm_s16le",
      "-ac",
      "1",
      "-ar",
      "16000",
      "pipe:1",
    ]);

    ffmpeg.stdout.on("data", (pcm) => {
      if (assembly.readyState === WebSocket.OPEN) {
        assembly.send(
          JSON.stringify({
            audio_data: pcm.toString("base64"),
          })
        );
      }
    });
  });

  // 🧠 Transcripts from AssemblyAI → Browser
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

  // 🎙️ Audio from browser → FFmpeg
  client.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "audio" && data.chunk && ffmpeg) {
        ffmpeg.stdin.write(Buffer.from(data.chunk, "base64"));
      }
    } catch (e) {
      console.error("❌ Invalid browser message", e);
    }
  });

  const cleanup = () => {
    console.log("❌ Client disconnected");

    if (assembly.readyState === WebSocket.OPEN) {
      assembly.send(JSON.stringify({ terminate_session: true }));
      assembly.close();
    }

    if (ffmpeg) {
      ffmpeg.kill("SIGKILL");
    }
  };

  client.on("close", cleanup);
  client.on("error", cleanup);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WS listening on port ${PORT}`);
});
