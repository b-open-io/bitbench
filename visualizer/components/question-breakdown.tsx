"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  HelpCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SuiteQuestionBreakdown, QuestionBreakdown } from "@/lib/types";

interface QuestionBreakdownProps {
  suiteId: string;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return "text-green-500";
  if (rate >= 60) return "text-yellow-500";
  if (rate >= 40) return "text-orange-500";
  return "text-red-500";
}

function getSuccessRateBg(rate: number): string {
  if (rate >= 80) return "bg-green-500/10";
  if (rate >= 60) return "bg-yellow-500/10";
  if (rate >= 40) return "bg-orange-500/10";
  return "bg-red-500/10";
}

function QuestionItem({ question, index }: { question: QuestionBreakdown; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const isProblematic = question.successRate < 50;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg ${
            isProblematic ? "border-l-4 border-red-500/50" : ""
          }`}
        >
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-2 shrink-0">
            {isProblematic ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">Q{question.testIndex + 1}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{truncateText(question.prompt, 100)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="secondary"
              className={`${getSuccessRateBg(question.successRate)} ${getSuccessRateColor(
                question.successRate
              )}`}
            >
              {question.successRate.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground">
              {question.correctCount}/{question.totalModels}
            </span>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-12 mr-4 mb-4 p-4 rounded-lg bg-muted/30 space-y-4">
          {/* Full prompt */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Full Question:</p>
            <p className="text-sm font-mono bg-background/50 p-2 rounded whitespace-pre-wrap">
              {question.prompt}
            </p>
          </div>

          {/* Expected answers */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Expected Answers:</p>
            <div className="flex flex-wrap gap-1">
              {question.answers.map((answer, i) => (
                <Badge key={i} variant="outline" className="font-mono text-xs">
                  {answer}
                </Badge>
              ))}
            </div>
          </div>

          {/* Model results */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Model Results ({question.correctCount} correct, {question.totalModels - question.correctCount} incorrect):
            </p>
            <div className="grid gap-2">
              {question.modelResults.map((result) => (
                <ModelResultRow key={result.model} result={result} />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ModelResultRow({ result }: { result: QuestionBreakdown["modelResults"][0] }) {
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="text-sm">
      <div
        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-background/50 ${
          result.correct ? "bg-green-500/5" : "bg-red-500/5"
        }`}
        onClick={() => setShowResponse(!showResponse)}
      >
        {result.correct ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
        <span className="font-medium flex-1 truncate">{result.model}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {(result.duration / 1000).toFixed(2)}s
              </span>
            </TooltipTrigger>
            <TooltipContent>Response time</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                ${result.cost.toFixed(4)}
              </span>
            </TooltipTrigger>
            <TooltipContent>Cost</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            showResponse ? "rotate-180" : ""
          }`}
        />
      </div>
      {showResponse && (
        <div className="ml-7 mt-2 p-2 rounded bg-background/50 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
          {result.response}
        </div>
      )}
    </div>
  );
}

export function QuestionBreakdownCard({ suiteId }: QuestionBreakdownProps) {
  const [breakdown, setBreakdown] = useState<SuiteQuestionBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function fetchBreakdown() {
      try {
        setLoading(true);
        const res = await fetch(`/api/suites/${suiteId}/questions`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("No detailed results available yet");
          } else {
            throw new Error("Failed to fetch");
          }
          return;
        }
        const data = await res.json();
        setBreakdown(data);
      } catch (err) {
        setError("Failed to load question breakdown");
      } finally {
        setLoading(false);
      }
    }

    fetchBreakdown();
  }, [suiteId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Question Analysis</CardTitle>
          <CardDescription>Loading detailed results...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !breakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Question Analysis</CardTitle>
          <CardDescription>{error || "No data available"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            {error || "Detailed question data will appear after syncing results."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const problematicCount = breakdown.questions.filter((q) => q.successRate < 50).length;
  const displayQuestions = showAll ? breakdown.questions : breakdown.questions.slice(0, 10);

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-medium">Question Analysis</CardTitle>
            <CardDescription>
              {breakdown.totalQuestions} questions tested across {breakdown.totalModels} models
              {problematicCount > 0 && (
                <span className="ml-2 text-red-500">
                  ({problematicCount} problematic questions &lt;50%)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-red-500/10 text-center">
            <div className="text-2xl font-bold text-red-500">
              {breakdown.questions.filter((q) => q.successRate < 40).length}
            </div>
            <div className="text-xs text-muted-foreground">Hard (&lt;40%)</div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {breakdown.questions.filter((q) => q.successRate >= 40 && q.successRate < 70).length}
            </div>
            <div className="text-xs text-muted-foreground">Medium (40-70%)</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <div className="text-2xl font-bold text-green-500">
              {breakdown.questions.filter((q) => q.successRate >= 70).length}
            </div>
            <div className="text-xs text-muted-foreground">Easy (&gt;70%)</div>
          </div>
        </div>

        {/* Questions list */}
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {displayQuestions.map((question, index) => (
              <QuestionItem key={question.testIndex} question={question} index={index} />
            ))}
          </div>
        </ScrollArea>

        {breakdown.questions.length > 10 && !showAll && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Show all {breakdown.questions.length} questions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
