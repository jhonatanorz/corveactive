import Link from "next/link";
import Image from "next/image";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={className} aria-label="CORVE">
      <Image src="/logo.png" alt="CORVE" width={2097} height={510} priority className="h-5 w-auto" />
    </Link>
  );
}
