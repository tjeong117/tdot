import Link from 'next/link'

/* Every page except the home page opens with this. The arrow drifts a couple
   of pixels left on hover, the only motion on the page besides the banner. */
export function Back() {
  return (
    <Link href="/" className="back">
      <span className="back-arrow">←</span> home
    </Link>
  )
}
