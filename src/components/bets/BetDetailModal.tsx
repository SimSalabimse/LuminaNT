import type { Bet } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CaseFileContent } from "@/components/bets/CaseFileContent";

interface Props {
  bet: Bet | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Modal Case File — used on narrower screens (<1440px) */
export function BetDetailModal({ bet, open, onOpenChange }: Props) {
  if (!bet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Case File · {bet.match}</DialogTitle>
          <DialogDescription>Bet forensic detail</DialogDescription>
        </DialogHeader>
        <CaseFileContent bet={bet} />
      </DialogContent>
    </Dialog>
  );
}
