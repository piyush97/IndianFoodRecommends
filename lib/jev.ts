import { z } from "zod";
import { CITIES } from "./cities";
import type { ExtractedPick } from "./llm/extract";

/**
 * Jev (TypeSafe) is a classifier, not a text generator: ~$0.04 per million input
 * tokens. We ask it cheap yes/no and pick-one questions so the expensive LLM only
 * reads videos that can produce a pick in a city we cover.
 */

type Video = { title: string; description: string };

export type VideoVerdict = {
  namesPlace: number;
  negative: number;
  city: "covered" | "other" | "unknown";
  cityConfidence: number;
};

// Thresholds picked from a 15-video run on Aayush Sapra's feed. Skips are
// conservative: an unsure answer still goes to the LLM and a human.
const NO_PLACE_BELOW = 0.05;
const NEGATIVE_ABOVE = 0.8;
const OTHER_CITY_CONFIDENCE = 0.85;

export function shouldExtract(
  v: VideoVerdict,
): { extract: true } | { extract: false; reason: "no-place" | "negative" | "not-covered" } {
  if (v.namesPlace < NO_PLACE_BELOW) return { extract: false, reason: "no-place" };
  if (v.negative > NEGATIVE_ABOVE) return { extract: false, reason: "negative" };
  if (v.city === "other" && v.cityConfidence >= OTHER_CITY_CONFIDENCE) {
    return { extract: false, reason: "not-covered" };
  }
  return { extract: true };
}

const Noul = z.object({ noul: z.number().min(0).max(1) });
const CityAnswer = z.object({
  choice: z.enum(["covered", "other", "unknown"]),
  confidence: z.number().min(0).max(1),
});
const Answers = z.object({
  answers: z.object({ names_place: Noul, negative: Noul, city: CityAnswer }),
});

export async function classifyVideo(
  video: Video,
  opts: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<VideoVerdict> {
  const res = await (opts.fetchImpl ?? fetch)("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "jev-latest",
      state: { title: video.title, description: video.description.slice(0, 6000) },
      questions: {
        names_place: {
          type: "noul",
          instructions:
            "The `title` or `description` names a specific restaurant, shop, or street-food stall",
        },
        negative: {
          type: "noul",
          instructions:
            "The video mainly warns viewers away from the food places it shows (unhygienic, hated, worst)",
        },
        city: {
          type: "choice",
          instructions: "Which city the food place in the video is in",
          criteria: {
            covered: CITIES.map((c) => [c.name, ...c.aliases].join(", ")).join("; "),
            other: "A city not in that list",
            unknown: "No city can be determined",
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Jev request failed with status ${res.status}`);
  const body = Answers.parse(await res.json());
  return {
    namesPlace: body.answers.names_place.noul,
    negative: body.answers.negative.noul,
    city: body.answers.city.choice,
    cityConfidence: body.answers.city.confidence,
  };
}

/** Wraps an LLM extractor so Jev decides first. Jev outages fall through to the LLM. */
export function gatedExtract(
  classify: (video: Video) => Promise<VideoVerdict>,
  extract: (video: Video) => Promise<ExtractedPick[]>,
): (video: Video) => Promise<ExtractedPick[]> {
  return async (video) => {
    let verdict: VideoVerdict;
    try {
      verdict = await classify(video);
    } catch (error) {
      console.error("jev: classify failed, using LLM:", error);
      return extract(video);
    }
    const decision = shouldExtract(verdict);
    if (!decision.extract) {
      console.log(`jev: skip (${decision.reason})`);
      return [];
    }
    return extract(video);
  };
}
