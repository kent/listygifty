import { cn } from "@/lib/utils";

interface ItemPhotoProps {
  src: string;
  alt: string;
  className?: string;
}

/** A gift or wishlist item's photo, cropped to fill its box. Size it with className. */
export function ItemPhoto({ src, alt, className }: ItemPhotoProps) {
  return (
    // Photos stream from the API's own host, so they skip Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800", className)}
    />
  );
}
