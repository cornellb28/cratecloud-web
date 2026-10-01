// app/api/storage/presign/route.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

const ALLOWED_EXTS = new Set(["mp3", "wav", "aiff", "aif", "flac", "m4a"]);

const REQUIRED_ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

export async function POST(req: Request) {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        console.error("R2 presign: missing env vars:", missing.join(", "));
        return NextResponse.json({ error: "Storage is not configured" }, { status: 500 });
    }

    const { userId, clientUuid, ext } = await req.json();

    // TODO: replace userId from the body with the authenticated session's user
    // TODO: check active subscription + storage quota before signing
    if (!userId || !clientUuid || !ALLOWED_EXTS.has(String(ext).toLowerCase())) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // originals/ prefix is targeted by the Standard -> Infrequent Access lifecycle rule
    const key = `originals/${userId}/${clientUuid}.${ext.toLowerCase()}`;

    const url = await getSignedUrl(
        r2,
        new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
        { expiresIn: 600 } // 10 minutes
    );

    return NextResponse.json({ url, key });
}