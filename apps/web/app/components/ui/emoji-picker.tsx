import * as Popover from "@radix-ui/react-popover";
import { Smile } from "lucide-react";
import { emojiCategories } from "~/lib/emoji-data";

/**
 * @radix-ui/react-popover, not Dialog/Sheet — the picker shouldn't demand a
 * focus trap or dim the page behind it the way those do, and unlike a
 * DropdownMenu it doesn't auto-close after a single selection, so picking
 * several emoji in a row (a common thing to want) doesn't mean reopening it
 * each time.
 */
export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Insérer un emoji"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <Smile className="h-5 w-5" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="anim-rise z-50 w-72 rounded-2xl border border-line bg-raised p-3 shadow-2xl outline-none"
        >
          <div className="max-h-72 overflow-y-auto">
            {emojiCategories.map((category) => (
              <div key={category.label} className="mb-3 last:mb-0">
                <p className="mb-1.5 text-xs font-medium text-muted">{category.label}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {category.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      aria-label={emoji}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-sunken"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Popover.Arrow className="fill-raised" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
