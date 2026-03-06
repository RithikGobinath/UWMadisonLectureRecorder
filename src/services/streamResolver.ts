import axios from "axios";

import { Schedule } from "../types";

function decodeHtmlEntities(value: string): string {
  return value.replace(/&amp;/g, "&");
}

function extractFirstMatch(html: string, regex: RegExp): string | null {
  const match = regex.exec(html);
  if (!match || !match[1]) {
    return null;
  }
  return decodeHtmlEntities(match[1]);
}

export async function resolveMediaUrl(schedule: Schedule): Promise<string> {
  if (schedule.directStreamUrl) {
    return schedule.directStreamUrl;
  }

  const response = await axios.get<string>(schedule.streamPageUrl, {
    timeout: 20_000,
    responseType: "text",
  });
  const html = response.data;

  const m3u8Match = extractFirstMatch(
    html,
    /(https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*)/i
  );
  if (m3u8Match) {
    return m3u8Match;
  }

  const mp4Match = extractFirstMatch(
    html,
    /(https?:\/\/[^"'\\\s]+\.mp4[^"'\\\s]*)/i
  );
  if (mp4Match) {
    return mp4Match;
  }

  throw new Error(
    "Could not resolve a media URL from streamPageUrl. Provide directStreamUrl explicitly."
  );
}
