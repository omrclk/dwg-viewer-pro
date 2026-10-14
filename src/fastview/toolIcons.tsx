import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function FvNavAnnotation(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M8 10h8M8 13h5" />
    </Base>
  )
}

export function FvNavDraw(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20l4-1 9-9-3-3-9 9-1 4z" />
      <path d="M14 5l3 3" />
    </Base>
  )
}

export function FvNavEdit(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="13" height="16" rx="1.5" />
      <path d="M8 8h6M8 11h6M8 14h4" />
      <path d="M16 4l4 4-7 7H9v-4z" />
    </Base>
  )
}

export function FvNavLayer(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4 4 8l8 4 8-4-8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </Base>
  )
}

export function FvNavMeasure(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="8" width="18" height="8" rx="1" />
      <path d="M6 11v2M9 10.5v3M12 11v2M15 10.5v3M18 11v2" />
    </Base>
  )
}

export function FvNavDimension(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 8v8M19 8v8" />
      <path d="M5 12h14" />
      <path d="M7 10.5 5 12l2 1.5M17 10.5l2 1.5-2 1.5" />
    </Base>
  )
}

export function FvNavColor({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" fill="url(#fv-color-wheel)" stroke="#fff" strokeWidth="1.2" />
      <defs>
        <linearGradient id="fv-color-wheel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff3b30" />
          <stop offset="20%" stopColor="#ffcc00" />
          <stop offset="40%" stopColor="#34c759" />
          <stop offset="60%" stopColor="#32ade6" />
          <stop offset="80%" stopColor="#5856d6" />
          <stop offset="100%" stopColor="#ff2d55" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function FvTopSave(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5h11l3 3v11H5z" />
      <path d="M8 5v5h8V5" />
      <rect x="8" y="14" width="8" height="5" rx="0.5" />
    </Base>
  )
}

export function FvTopLayout(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1" strokeDasharray="3 2" />
      <path d="M12 6v12" strokeDasharray="3 2" />
    </Base>
  )
}

export function FvTopZoomWindow(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M14.5 14.5 19 19" />
      <rect x="7.5" y="7.5" width="5" height="5" rx="0.5" />
    </Base>
  )
}

export function FvTopFit(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
    </Base>
  )
}

export function FvTextStyle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 6h10M12 6v12" strokeWidth="2" />
      <path d="M8 18h8" />
    </Base>
  )
}

export function FvPolyline(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 18 10 8l6 4 8-6" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="22" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function FvLine(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 19 19 5" />
      <circle cx="5" cy="19" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.3" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function FvText(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 6h8M12 6v12" strokeWidth="2.2" />
    </Base>
  )
}

export function FvCircle(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 12V5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function FvArc(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18a9 9 0 0 1 12-12" />
      <circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function FvRect(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="7" width="14" height="10" rx="0.5" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="17" r="1" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function FvEllipse(props: IconProps) {
  return (
    <Base {...props}>
      <ellipse cx="12" cy="12" rx="8" ry="5" />
      <path d="M12 7v10M4 12h16" strokeDasharray="2 2" opacity="0.5" />
    </Base>
  )
}

export function FvSketch(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 16c3-6 5-8 8-8s5 2 8 8" />
      <path d="M16 6l2-2 2 2-2 2z" />
    </Base>
  )
}

export function FvLayerStack(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5 4 9l8 4 8-4-8-4z" />
      <path d="M4 13l8 4 8-4" />
    </Base>
  )
}

export function FvLayerPlus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 6 5 10l7 4 7-4-7-4z" />
      <path d="M12 14v5M9.5 16.5H14.5" />
    </Base>
  )
}

export function FvLayerList(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5 5 9l7 4 7-4-7-4z" />
      <path d="M5 14h5M5 17h7" />
    </Base>
  )
}

export function FvLayerOff(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 14 12 8l6 6" transform="rotate(-12 12 12)" />
      <rect x="5" y="6" width="14" height="12" rx="1" transform="rotate(-12 12 12)" />
    </Base>
  )
}

export function FvLayerIsolate(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 6 5 10l7 4 7-4-7-4z" />
      <path d="M9 16h6" />
      <circle cx="12" cy="16" r="2.5" />
    </Base>
  )
}

export function FvLayerAllOn(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5 4 9l8 4 8-4-8-4z" />
      <path d="M4 13l8 4 8-4" />
      <circle cx="18" cy="7" r="2" fill="currentColor" stroke="none" opacity="0.85" />
    </Base>
  )
}

export function FvRulerDistance(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 14h16" />
      <path d="M7 11v6M12 11v6M17 11v6" />
      <path d="M6 14h2M11 14h2M16 14h2" strokeWidth="2" />
    </Base>
  )
}

export function FvRulerArea(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18a8 8 0 0 1 0-12" />
      <path d="M6 18h10" />
      <path d="M8 16v2M12 16v2M16 16v2" />
    </Base>
  )
}

export function FvRulerPoint(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 19V5M5 12h14" />
      <circle cx="14" cy="9" r="2" />
    </Base>
  )
}

export function FvRulerAngle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18 18 6" />
      <path d="M6 18h8" />
      <path d="M8 16a4 4 0 0 1 4-4" />
    </Base>
  )
}

export function FvDimLinear(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 8v8M19 8v8" />
      <path d="M5 12h14" />
      <path d="M7 10.5 5 12l2 1.5M17 10.5l2 1.5-2 1.5" />
    </Base>
  )
}

export function FvDimAligned(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18 18 6" />
      <path d="M8.5 15.5 6 18l2.5 2.5M15.5 8.5 18 6l-2.5-2.5" />
    </Base>
  )
}

export function FvTrim(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 19 19 5" />
      <path d="M10 14l4-4" strokeDasharray="2 2" />
    </Base>
  )
}

export function FvExtend(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h12" strokeDasharray="3 2" />
      <path d="M16 12h4" />
      <path d="M18 10v4" />
    </Base>
  )
}

export function FvOffset(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 8c4 0 6 2 6 6s-2 6-6 6" />
      <path d="M10 8c4 0 6 2 6 6s-2 6-6 6" />
    </Base>
  )
}

export function FvFillet(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18V10h8" />
      <path d="M6 18h8V10" />
      <path d="M6 14a4 4 0 0 1 4-4h4" />
    </Base>
  )
}

export function FvChamfer(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18V10h8" />
      <path d="M6 18h8V10" />
      <path d="M6 14l4-4" />
    </Base>
  )
}

export function FvArrow(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18 18 6" />
      <path d="M12 6h6v6" />
    </Base>
  )
}

export function FvRevcloud(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 14a3 3 0 0 1 0-4 3 3 0 0 1 4 0 3 3 0 0 1 4 0 3 3 0 0 1 0 4 3 3 0 0 1-4 0 3 3 0 0 1-4 0z" />
    </Base>
  )
}

export function FvLeader(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 18 12 10" />
      <rect x="12" y="5" width="8" height="6" rx="1" />
      <path d="M14 7h4M14 9h3" />
    </Base>
  )
}

export type FvIconComponent = (props: IconProps) => ReactNode
