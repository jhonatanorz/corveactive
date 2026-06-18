/** Small product thumbnail with a graceful placeholder when there's no image.
 *  Size is controlled by the caller via `className` (e.g. "h-10 w-8"). */
export function Thumb({ src, alt = "", className = "h-10 w-8" }: { src: string | null; alt?: string; className?: string }) {
  if (!src) {
    return <div className={`shrink-0 rounded-md border border-line bg-mist ${className}`} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`shrink-0 rounded-md border border-line object-cover ${className}`} />
  );
}
