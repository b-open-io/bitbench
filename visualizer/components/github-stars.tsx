"use client";

import { useEffect, useState } from "react";
import { Github } from "lucide-react";

const REPO = "b-open-io/bitbench";

export function useGitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  return stars;
}

export function GitHubStars() {
  const stars = useGitHubStars();

  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Github className="h-4 w-4" />
      {stars !== null && (
        <span className="text-xs tabular-nums">{stars}</span>
      )}
    </a>
  );
}
