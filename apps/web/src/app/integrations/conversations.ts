import type { Conversation } from "./SampleConversation";

export const conversations = {
  chatgpt: [
    "Can you add the new Hunger Games book as a gift idea for Alice?",
    "Saved it for Alice on your Christmas 2026 gift list.",
    "I’m heading to Sherway. What can I knock off my Christmas 2026 list today?",
    "I’d start with Alice’s book at a bookstore, then look for the wool scarf you saved for Dad.",
  ],
  claude: [
    "Can you add a 3D printer to my wishlist?",
    "Added a 3D printer to your wishlist.",
    "Can you add a note that I want one that fits on my desk?",
    "Done. The note says “Small enough for my desk.”",
  ],
  runner: [
    "I’m going shopping at Sherway. What’s left on my Christmas 2026 gift list?",
    "You still have Alice’s Hunger Games book and Dad’s wool scarf to pick up.",
    "I found the scarf! Can you mark it as bought?",
    "Marked Dad’s scarf as purchased. Alice’s book is still on your list.",
  ],
  "grok-bot": [
    "Who did I draw for Secret Santa?",
    "You drew Alex in the family exchange.",
    "What’s on Alex’s wishlist?",
    "A desk plant and a coffee grinder.",
  ],
} as const satisfies Record<string, Conversation>;
