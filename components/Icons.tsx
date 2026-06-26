import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function ArrowIcon(props: Props) {
  return <svg {...base} {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
export function PlayIcon(props: Props) {
  return <svg {...base} {...props}><path d="m8 5 11 7-11 7Z" /></svg>;
}
export function CheckIcon(props: Props) {
  return <svg {...base} {...props}><path d="m5 12 4 4L19 6" /></svg>;
}
export function PinIcon(props: Props) {
  return <svg {...base} {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
export function CameraIcon(props: Props) {
  return <svg {...base} {...props}><path d="M4 7h3l2-2h6l2 2h3v12H4Z" /><circle cx="12" cy="13" r="4" /></svg>;
}
export function ShieldIcon(props: Props) {
  return <svg {...base} {...props}><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
}
export function TrophyIcon(props: Props) {
  return <svg {...base} {...props}><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></svg>;
}
export function SparkIcon(props: Props) {
  return <svg {...base} {...props}><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z" /></svg>;
}
export function GaugeIcon(props: Props) {
  return <svg {...base} {...props}><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 12 4-3M7 18h10" /></svg>;
}
export function RouteIcon(props: Props) {
  return <svg {...base} {...props}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h2a4 4 0 0 0 4-4V10a4 4 0 0 1 4-4" /></svg>;
}
export function FuelIcon(props: Props) {
  return <svg {...base} {...props}><path d="M5 21V4h10v17M4 21h12M7 8h6" /><path d="m15 7 3 3v7a2 2 0 0 0 4 0v-5l-2-2" /></svg>;
}
export function ResetIcon(props: Props) {
  return <svg {...base} {...props}><path d="M4 4v6h6" /><path d="M5.5 15a7 7 0 1 0 .5-7" /></svg>;
}
