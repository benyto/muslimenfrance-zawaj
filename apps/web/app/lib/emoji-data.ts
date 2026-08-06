// A curated subset, not the full ~3800-emoji Unicode set — a chat composer
// picker benefits more from "the ones people actually use" being easy to
// scan than from completeness, and it keeps this a plain ~150-entry array
// instead of pulling in an emoji-data package and its own picker UI (which
// would ship its own look, clashing with the rest of the design system).
export const emojiCategories: { label: string; emojis: string[] }[] = [
  {
    label: "Sourires",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "🥹", "😅", "😂", "🤣", "🙂",
      "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😙",
      "😋", "😛", "🤗", "🤭", "🤔", "🤨", "😐", "🙄", "😏", "😌",
      "😔", "🙁", "😢", "😭", "😮", "😲", "😴", "😅", "🥲", "😳",
    ],
  },
  {
    label: "Amour",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💑", "💏",
      "😍", "🥰", "😘", "💍", "💐", "🌹",
    ],
  },
  {
    label: "Gestes",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👋", "🤝", "🙏",
      "💪", "👏", "🙌", "✋", "🤲", "👐",
    ],
  },
  {
    label: "Nature",
    emojis: [
      "🌸", "🌺", "🌻", "🌷", "🌼", "🍀", "🌙", "⭐", "✨", "☀️",
      "🌈", "🔥", "🐱", "🐶", "🕊️",
    ],
  },
  {
    label: "Nourriture",
    emojis: ["☕", "🍵", "🍰", "🎂", "🍫", "🍓", "🍯", "🍩"],
  },
  {
    label: "Autres",
    emojis: [
      "🎉", "🎁", "📷", "✈️", "🏠", "🕌", "☪️", "📿", "💯", "✅",
      "❌", "⚡", "🎶", "📱",
    ],
  },
];
