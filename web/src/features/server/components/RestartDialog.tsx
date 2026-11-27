import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const OPTIONS = [
  { seconds: 0, label: "Now" },
  { seconds: 30, label: "In 30 seconds" },
  { seconds: 60, label: "In 1 minute" },
  { seconds: 120, label: "In 2 minutes" },
  { seconds: 300, label: "In 5 minutes" },
];

interface Props {
  open: boolean;
  players: number;
  onOpenChange: (open: boolean) => void;
  onRestart: (warnSeconds: number) => void;
}

export function RestartDialog({ open, players, onOpenChange, onRestart }: Props) {
  const [seconds, setSeconds] = useState(players > 0 ? 60 : 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSeconds(players > 0 ? 60 : 0);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restart the server?</DialogTitle>
          <DialogDescription>
            {players > 0
              ? `${players} player${players === 1 ? " is" : "s are"} online. A delayed restart warns them in the chat (needs RCON).`
              : "Nobody is online right now."}
          </DialogDescription>
        </DialogHeader>
        {players > 0 && (
          <div className="restart-options" role="radiogroup">
            {OPTIONS.map((o) => (
              <label key={o.seconds} className={`restart-option ${seconds === o.seconds ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="restart-delay"
                  checked={seconds === o.seconds}
                  onChange={() => setSeconds(o.seconds)}
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={players > 0 && seconds === 0 ? "destructive" : "default"}
            onClick={() => {
              onOpenChange(false);
              onRestart(seconds);
            }}
          >
            {seconds === 0 ? "Restart now" : "Schedule restart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
