"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SponsorsResponse, Sponsor } from "@/app/api/sponsors/route";

function SponsorAvatar({
  sponsor,
  size = "md",
}: {
  sponsor: Sponsor;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };

  return (
    <Image
      src={sponsor.avatarUrl}
      alt={sponsor.name || sponsor.login}
      width={size === "lg" ? 64 : size === "md" ? 40 : 24}
      height={size === "lg" ? 64 : size === "md" ? 40 : 24}
      className={`${sizeClasses[size]} rounded-full bg-muted`}
    />
  );
}

function DiamondSponsor({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-3 rounded-xl border-2 border-chart-4/30 bg-card/50 p-6 transition-all hover:border-chart-4/60 hover:bg-card"
    >
      <div className="relative">
        <SponsorAvatar sponsor={sponsor} size="lg" />
        <div className="absolute -bottom-1 -right-1 rounded-full bg-chart-4 p-1">
          <span className="text-xs">💎</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">
          {sponsor.name || sponsor.login}
        </p>
        <p className="text-xs text-muted-foreground">Diamond Sponsor</p>
      </div>
    </Link>
  );
}

function LegendarySponsor({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-chart-4/20 bg-card/30 px-4 py-3 transition-all hover:border-chart-4/40 hover:bg-card/50"
    >
      <SponsorAvatar sponsor={sponsor} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {sponsor.name || sponsor.login}
        </p>
        <p className="text-xs text-chart-4">Legendary</p>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function RegularSponsor({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
    >
      <SponsorAvatar sponsor={sponsor} size="sm" />
      <span className="text-sm text-muted-foreground group-hover:text-foreground truncate">
        {sponsor.name || sponsor.login}
      </span>
    </Link>
  );
}

function BackerName({ sponsor }: { sponsor: Sponsor }) {
  return (
    <Link
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {sponsor.name || sponsor.login}
    </Link>
  );
}

export function SponsorSection() {
  const [data, setData] = useState<SponsorsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSponsors() {
      try {
        const res = await fetch("/api/sponsors");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch sponsors:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSponsors();
  }, []);

  const hasSponsors = data && data.sponsors.length > 0;

  return (
    <section className="border-t border-border bg-muted/30 py-12">
      <div className="mx-auto max-w-7xl px-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Diamond Sponsors */}
            {data?.grouped.diamond && data.grouped.diamond.length > 0 && (
              <div className="mb-10">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-chart-4 mb-6">
                  Diamond Sponsors
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-6">
                  {data.grouped.diamond.map((sponsor) => (
                    <DiamondSponsor key={sponsor.login} sponsor={sponsor} />
                  ))}
                </div>
              </div>
            )}

            {/* Legendary Sponsors */}
            {data?.grouped.legendary && data.grouped.legendary.length > 0 && (
              <div className="mb-10">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-chart-4/80 mb-6">
                  Legendary Sponsors
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {data.grouped.legendary.map((sponsor) => (
                    <LegendarySponsor key={sponsor.login} sponsor={sponsor} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Sponsors */}
            {data?.grouped.sponsor && data.grouped.sponsor.length > 0 && (
              <div className="mb-8">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Sponsors
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {data.grouped.sponsor.map((sponsor) => (
                    <RegularSponsor key={sponsor.login} sponsor={sponsor} />
                  ))}
                </div>
              </div>
            )}

            {/* Backers */}
            {data?.grouped.backer && data.grouped.backer.length > 0 && (
              <div className="mb-8">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Backers
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {data.grouped.backer.map((sponsor) => (
                    <BackerName key={sponsor.login} sponsor={sponsor} />
                  ))}
                </div>
              </div>
            )}

            {/* Supporters */}
            {data?.grouped.supporter && data.grouped.supporter.length > 0 && (
              <div className="mb-8">
                <p className="text-center text-xs text-muted-foreground">
                  Supporters:{" "}
                  {data.grouped.supporter
                    .map((s) => s.name || s.login)
                    .join(" • ")}
                </p>
              </div>
            )}

            {/* Call to Action */}
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {hasSponsors
                  ? "Help us grow by becoming a sponsor and join this list of supporters!"
                  : "Be the first to sponsor BitBench and help fund open AI benchmarks for blockchain development."}
              </p>
              <Button asChild variant="outline" className="gap-2">
                <Link
                  href="https://github.com/sponsors/b-open-io"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Heart className="h-4 w-4 text-pink-500" />
                  Become a Sponsor
                </Link>
              </Button>
            </div>

            {/* Footer note */}
            <div className="mt-10 pt-6 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground">
                BitBench is open source.{" "}
                <Link
                  href="https://github.com/b-open-io/bitbench"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Star us on GitHub
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
