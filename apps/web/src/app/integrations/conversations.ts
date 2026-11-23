import type { Conversation } from "./SampleConversation";

export const conversations = {
  chatgpt: [
    "I’m at the bookstore. What was that book I saved for Mom?",
    "The Thursday Murder Club. It’s on your Christmas gift list for Mom.",
    "That’s it! Add a pottery class as another idea for her?",
    "Added a pottery class to your Christmas gift list for Mom.",
  ],
  claude: [
    "What’s on my birthday wishlist?",
    "A sketchbook and a ceramic mug.",
    "Add a watercolor set, too.",
    "Added a watercolor set to your birthday wishlist.",
  ],
  runner: [
    "What gift ideas did I save for Dad?",
    "Binoculars and a bird feeder.",
    "Which list are those on?",
    "Both are on your Christmas gift list.",
  ],
  "grok-bot": [
    "Who did I draw for Secret Santa?",
    "You drew Alex in the family exchange.",
    "What’s on Alex’s wishlist?",
    "A desk plant and a coffee grinder.",
  ],
} as const satisfies Record<string, Conversation>;
