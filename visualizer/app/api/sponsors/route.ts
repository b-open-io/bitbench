import { NextResponse } from "next/server";

export interface Sponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  tier: {
    name: string;
    monthlyPriceInDollars: number;
  } | null;
}

export interface SponsorsResponse {
  sponsors: Sponsor[];
  grouped: {
    diamond: Sponsor[];
    legendary: Sponsor[];
    sponsor: Sponsor[];
    backer: Sponsor[];
    supporter: Sponsor[];
  };
}

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const SPONSORS_QUERY = `
  query {
    organization(login: "b-open-io") {
      sponsorshipsAsMaintainer(first: 100, includePrivate: false) {
        nodes {
          sponsorEntity {
            ... on User {
              login
              name
              avatarUrl
              url
            }
            ... on Organization {
              login
              name
              avatarUrl
              url
            }
          }
          tier {
            name
            monthlyPriceInDollars
          }
        }
      }
    }
  }
`;

// Cache sponsors for 1 hour
let cachedSponsors: SponsorsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function groupSponsorsByTier(sponsors: Sponsor[]): SponsorsResponse["grouped"] {
  const grouped: SponsorsResponse["grouped"] = {
    diamond: [],
    legendary: [],
    sponsor: [],
    backer: [],
    supporter: [],
  };

  for (const sponsor of sponsors) {
    const amount = sponsor.tier?.monthlyPriceInDollars ?? 0;
    if (amount >= 100) {
      grouped.diamond.push(sponsor);
    } else if (amount >= 50) {
      grouped.legendary.push(sponsor);
    } else if (amount >= 25) {
      grouped.sponsor.push(sponsor);
    } else if (amount >= 10) {
      grouped.backer.push(sponsor);
    } else {
      grouped.supporter.push(sponsor);
    }
  }

  return grouped;
}

async function fetchSponsorsFromGitHub(): Promise<Sponsor[]> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.warn("GITHUB_TOKEN not configured");
    return [];
  }

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SPONSORS_QUERY }),
  });

  if (!response.ok) {
    console.error("GitHub API error:", response.status, await response.text());
    return [];
  }

  const data = await response.json();

  if (data.errors) {
    console.error("GitHub GraphQL errors:", data.errors);
    return [];
  }

  const nodes = data.data?.organization?.sponsorshipsAsMaintainer?.nodes ?? [];

  return nodes
    .filter((node: { sponsorEntity: Sponsor | null }) => node.sponsorEntity)
    .map((node: { sponsorEntity: Sponsor; tier: Sponsor["tier"] }) => ({
      login: node.sponsorEntity.login,
      name: node.sponsorEntity.name,
      avatarUrl: node.sponsorEntity.avatarUrl,
      url: node.sponsorEntity.url,
      tier: node.tier,
    }));
}

export async function GET() {
  const now = Date.now();

  // Return cached data if still valid
  if (cachedSponsors && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedSponsors);
  }

  const sponsors = await fetchSponsorsFromGitHub();
  const grouped = groupSponsorsByTier(sponsors);

  cachedSponsors = { sponsors, grouped };
  cacheTimestamp = now;

  return NextResponse.json(cachedSponsors);
}
