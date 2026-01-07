import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!ASSEMBLYAI_API_KEY) {
  throw new Error("❌ Missing ASSEMBLYAI_API_KEY");
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

console.log("✅ WS server initialized");

wss.on("connection", (clientSocket) => {
  console.log("🔌 Browser connected");

  // 🔗 Connect to AssemblyAI Realtime
  const assemblySocket = new WebSocket(
    "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000",
    {
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
      },
    }
  );

  assemblySocket.on("open", () => {
    console.log("🧠 Connected to AssemblyAI Realtime");
  });

  // 🎙️ Receive audio from browser → send to AssemblyAI
  clientSocket.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "audio" && data.chunk) {
        assemblySocket.send(
          JSON.stringify({
            audio_data: data.chunk,
          })
        );
      }
    } catch (e) {
      console.error("❌ Invalid client message", e);
    }
  });

  // 🧠 Receive transcript from AssemblyAI → send to browser
  assemblySocket.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.text) {
        clientSocket.send(
          JSON.stringify({
            text: data.text,
            isFinal: data.message_type === "FinalTranscript",
          })
        );
      }
    } catch (e) {
      console.error("❌ Invalid AssemblyAI message", e);
    }
  });

  const cleanup = () => {
    if (assemblySocket.readyState === WebSocket.OPEN) {
      assemblySocket.send(JSON.stringify({ terminate_session: true }));
      assemblySocket.close();
    }
  };

  clientSocket.on("close", cleanup);
  clientSocket.on("error", cleanup);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 WS listening on port ${PORT}`);
});
