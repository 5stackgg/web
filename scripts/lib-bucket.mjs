// Signed access to the 5stack B2 bucket, shared by the map-asset publishers.
//
// Reads and HEADs go to B2 directly, never through the demo-dl worker: the
// worker caches, and a publisher deciding whether a key already exists needs
// the bucket's answer, not the edge's.
//
// FAIL CLOSED. Publishing never overwrites, so "is this key free" must never
// be answered yes by accident. B2 answers a missing key with 403 instead of
// 404 when the credential cannot list the bucket -- the same 403 it gives a
// transient denial -- so a 403 is settled by listing the exact key, and if
// the listing is refused too the call throws. A publishing key needs
// listFiles alongside readFiles and writeFiles.
import { AwsClient } from "aws4fetch";

const ATTEMPTS = 3;

export function bucketFromEnv() {
  const accessKey = process.env.S3_ACCESS_KEY;
  const secret = process.env.S3_SECRET;
  if (!accessKey || !secret) {
    return null;
  }
  return openBucket({
    accessKey,
    secret,
    bucket: process.env.BUCKET_NAME || "5stack",
    endpoint: process.env.S3_ENDPOINT || "s3.us-east-005.backblazeb2.com",
  });
}

function unescapeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function openBucket({ accessKey, secret, bucket, endpoint }) {
  const client = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secret, service: "s3" });
  const url = (key) => `https://${bucket}.${endpoint}/${key}`;

  const request = async (method, target) => {
    let response = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const signed = await client.sign(target, { method });
      response = await fetch(signed.url, { method, headers: signed.headers });
      if (response.status !== 403 && response.status < 500) {
        return response;
      }
      await response.body?.cancel();
    }
    return response;
  };

  /** Whether the bucket lists exactly `key`; throws when it will not say. */
  const listed = async (key) => {
    const query = new URLSearchParams({ "list-type": "2", prefix: key, "max-keys": "1" });
    const response = await request("GET", `https://${bucket}.${endpoint}/?${query}`);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `${key}: B2 answered 403 and refused to list it (${response.status}) -- ` +
          "cannot tell a missing key from a denied one, so nothing is assumed free " +
          "(the key needs listFiles)",
      );
    }
    const xml = await response.text();
    return [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].some((m) => unescapeXml(m[1]) === key);
  };

  return {
    url,

    /**
     * null when the key is known not to exist, else `{ sha256 }` from the
     * metadata put() stored with it (null for an object written without one,
     * or one that exists but could not be read). Throws when B2 will not say.
     */
    async head(key) {
      const response = await request("HEAD", url(key));
      if (response.status === 200) {
        return { sha256: response.headers.get("x-amz-meta-sha256") };
      }
      if (response.status === 404) {
        return null;
      }
      if (response.status === 403) {
        return (await listed(key)) ? { sha256: null } : null;
      }
      throw new Error(`HEAD ${key}: ${response.status}`);
    },

    async exists(key) {
      return (await this.head(key)) !== null;
    },

    /** The object's body, or null when it is known not to exist. */
    async get(key) {
      const response = await request("GET", url(key));
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
      await response.body?.cancel();
      if (response.status === 404) {
        return null;
      }
      if (response.status === 403 && !(await listed(key))) {
        return null;
      }
      throw new Error(`GET ${key}: ${response.status}`);
    },

    async put(key, body, { type, encoding = null, sha256 = null } = {}) {
      const signed = await client.sign(url(key), {
        method: "PUT",
        headers: {
          "Content-Type": type,
          ...(encoding ? { "Content-Encoding": encoding } : {}),
          ...(sha256 ? { "x-amz-meta-sha256": sha256 } : {}),
          "Content-Length": String(body.length),
        },
        body,
      });

      const response = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`PUT ${key}: ${response.status} ${await response.text().catch(() => "")}`);
      }
    },
  };
}
