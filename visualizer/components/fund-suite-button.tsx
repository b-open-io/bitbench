"use client"

import { useState } from "react"
import { DonationModal } from "@/components/donation-modal"
import { Button } from "@/components/ui/button"
import type { SuiteWithBalance } from "@/lib/types"

interface FundSuiteButtonProps {
  suite: SuiteWithBalance
}

export function FundSuiteButton({ suite }: FundSuiteButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Fund this benchmark
      </Button>
      <DonationModal suite={suite} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
