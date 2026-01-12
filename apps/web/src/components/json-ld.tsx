import { Thing, WithContext } from "schema-dts";

interface JsonLdProps<T extends Thing> {
  data: WithContext<T>;
}

export function JsonLd<T extends Thing>({ data }: JsonLdProps<T>) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

