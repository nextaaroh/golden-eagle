import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text missing" }, { status: 400 });
    }

    // Free Microsoft Edge Neural TTS Direct WebSocket Endpoint
    const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EA65407284F49D242E8E0F4E";
    const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='hi-IN'>
        <voice name='hi-IN-MadhurNeural'>
          <prosody pitch='-6Hz' rate='-2%'>
            ${text}
          </prosody>
        </voice>
      </speak>
    `.trim();

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const WebSocket = require("ws");
      const ws = new WebSocket(wssUrl);
      const chunks: Buffer[] = [];

      ws.on("open", () => {
        const date = new Date().toUTCString();
        // Config Header
        ws.send(
          `X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
        );

        // SSML Request
        const requestId = Math.random().toString(36).substring(2);
        ws.send(
          `X-RequestId:${requestId}\r\nX-Timestamp:${date}\r\nPath:ssml\r\n\r\n${ssml}`
        );
      });

      ws.on("message", (data: any, isBinary: boolean) => {
        if (isBinary) {
          const buffer = Buffer.from(data);
          const headerLen = buffer.readUInt16BE(0);
          if (buffer.length > headerLen + 2) {
            chunks.push(buffer.subarray(headerLen + 2));
          }
        } else {
          const messageStr = data.toString();
          if (messageStr.includes("Path:turn.end")) {
            ws.close();
            resolve(Buffer.concat(chunks));
          }
        }
      });

      ws.on("error", (err: any) => {
        ws.close();
        reject(err);
      });

      // Safety timeout
      setTimeout(() => {
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error("TTS timeout"));
        }
      }, 5000);
    });

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("TTS API error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}

// Force update fix
