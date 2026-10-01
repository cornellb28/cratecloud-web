// app/api/storage/download/route.ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  flac: "audio/flac",
  m4a: "audio/mp4",
};

// GET /api/storage/download?userId=...&clientUuid=...&ext=mp3[&redirect=1]
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const userId = params.get("userId");
  const clientUuid = params.get("clientUuid");
  const ext = params.get("ext")?.toLowerCase() ?? "";

  // TODO: take userId from the authenticated session, never from the query string
  // TODO: check the user owns this track / has an active subscription
  if (!userId || !clientUuid || !MIME_TYPES[ext]) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const key = `originals/${userId}/${clientUuid}.${ext}`;

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      // Serve with an audio MIME type so browsers play the file instead of downloading it
      ResponseContentType: MIME_TYPES[ext],
    }),
    { expiresIn: 3600 } // 1 hour, long enough to finish a track
  );

  // ?redirect=1 sends the browser straight to the file, handy for testing
  if (params.get("redirect") === "1") {
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ url, key });
}