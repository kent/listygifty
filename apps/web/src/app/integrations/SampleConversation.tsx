"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import styles from "./conversation.module.css";

type Playback = "idle" | "playing" | "paused" | "finished";
export type Conversation = readonly [string, string, string, string];

export function SampleConversation({ assistant, turns }: { assistant: string; turns: Conversation }) {
  const panel = useRef<HTMLElement>(null);
  const [playback, setPlayback] = useState<Playback>("idle");

  useEffect(() => {
    if (!panel.current || !window.IntersectionObserver) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || motion.matches) return;
      setPlayback(current => current === "idle" ? "playing" : current);
      observer.disconnect();
    }, { threshold: 0.35 });
    const updateMotion = () => {
      if (motion.matches) {
        observer.disconnect();
        setPlayback("idle");
      } else if (panel.current) {
        observer.observe(panel.current);
      }
    };
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", updateMotion);
    };
  }, []);

  const playing = playback === "playing";
  const action = playing ? "Pause" : playback === "paused" ? "Resume" : "Replay";
  const ControlIcon = playing ? Pause : playback === "paused" ? Play : RotateCcw;
  return (
    <figure ref={panel} data-playback={playback} aria-label={`Example conversation with ${assistant}`}
      className={`${styles.panel} mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 pb-4 text-sm dark:border-indigo-800 dark:bg-slate-950`}>
      <div className="flex min-h-12 items-center justify-between gap-2">
        <figcaption className="font-semibold">Example conversation</figcaption>
        {playback !== "idle" && (
          <button type="button" aria-label={`${action} ${assistant} conversation`}
            className={`${styles.control} inline-flex items-center gap-1.5 rounded px-2 py-2 text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2`}
            onClick={() => setPlayback(playing ? "paused" : "playing")}>
            <ControlIcon size={13} aria-hidden="true" /> {action}
          </button>
        )}
      </div>
      <ol className="space-y-3">
        {turns.map((message, index) => {
          const fromUser = index % 2 === 0;
          return (
            <li key={message} className={`${styles.turn} flex flex-col ${fromUser ? "items-end" : "items-start"}`}
              style={{ animationDelay: `${index * 1.7}s` }}
              onAnimationEnd={event => {
                if (index === turns.length - 1 && event.target === event.currentTarget) setPlayback("finished");
              }}>
              <span className="mb-1 text-xs font-semibold text-slate-600 dark:text-indigo-200">{fromUser ? "You" : assistant}</span>
              <p className={`max-w-[90%] rounded-2xl px-3.5 py-2 leading-snug ${fromUser
                ? "rounded-br-sm bg-violet-700 text-white"
                : "rounded-bl-sm border border-slate-200 bg-white text-slate-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-white"}`}>
                {message}
              </p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
