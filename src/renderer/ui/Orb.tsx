// The Auralis orb: a sphere of deep water with an aurora ribbon inside,
// lit from above like the Vista Start orb. Also the application icon
// (scripts/build-icons.mjs renders the same SVG).
import ORB_SVG from './orb.svg?raw'

export { ORB_SVG }

export function Orb({ size = 28 }: { size?: number }) {
  return <span className="orb-mark" style={{ width: size, height: size }} aria-hidden dangerouslySetInnerHTML={{ __html: ORB_SVG }} />
}
