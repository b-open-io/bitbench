"use client";

import { useState } from "react";
import { ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChainBadge } from "@/components/chain-badge";
import type { TestSuite, TestSuiteFile, TestQuestion } from "@/lib/types";

interface SuiteListModalProps {
  suites: TestSuite[];
}

function QuestionItem({ question, index }: { question: TestQuestion; index: number }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {index + 1}
        </span>
        <p className="text-sm font-mono whitespace-pre-wrap">{question.prompt}</p>
      </div>

      <div className="ml-9 space-y-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">Expected answers:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {question.answers.map((answer, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-mono bg-green-500/10 text-green-600 dark:text-green-400">
                {answer}
              </Badge>
            ))}
          </div>
        </div>

        {question.negative_answers && question.negative_answers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-muted-foreground">Negative answers:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {question.negative_answers.map((answer, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-mono bg-red-500/10 text-red-600 dark:text-red-400">
                  {answer}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SuiteListModal({ suites }: SuiteListModalProps) {
  const [selectedSuite, setSelectedSuite] = useState<TestSuiteFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleSuiteClick(suite: TestSuite) {
    setLoading(true);
    setDialogOpen(true);

    try {
      const res = await fetch(`/api/suites/${suite.id}/details`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSuite(data);
      }
    } catch (error) {
      console.error("Failed to fetch suite details:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setDialogOpen(false);
    setSelectedSuite(null);
  }

  return (
    <>
      <div className="grid gap-2">
        {suites.map((suite) => (
          <button
            type="button"
            key={suite.id}
            onClick={() => handleSuiteClick(suite)}
            className="flex items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="font-medium">{suite.name}</span>
                <ChainBadge chain={suite.chain} size="sm" className="ml-2" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm">{suite.testCount} tests</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedSuite ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedSuite.name}
                  <ChainBadge chain={selectedSuite.chain} size="sm" />
                </DialogTitle>
                <DialogDescription>{selectedSuite.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 flex-1 min-h-0">
                {/* System Prompt */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="text-sm font-medium mb-2">System Prompt</h4>
                  <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                    {selectedSuite.system_prompt}
                  </p>
                </div>

                {/* Version & Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Version: <span className="font-mono">{selectedSuite.version}</span>
                  </span>
                  <span>
                    Est. Cost: <span className="font-mono">${selectedSuite.estimatedCostUsd.toFixed(2)}</span>
                  </span>
                  <span>
                    Questions: <span className="font-mono">{selectedSuite.tests.length}</span>
                  </span>
                </div>

                {/* Questions */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Test Questions</h4>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {selectedSuite.tests.map((question, index) => (
                        <QuestionItem key={index} question={question} index={index} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
