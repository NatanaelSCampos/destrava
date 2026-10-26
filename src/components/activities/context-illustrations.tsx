import { useId } from "react";
import type { ReactNode } from "react";

/** Contextual artwork. Spatial facts and assessed quantities belong to authored stimuli. */
function Scene({label, children}: {label: string; children: ReactNode}) {
  const title = useId();
  return <svg className="scene-illustration" viewBox="0 0 300 250" role="img" aria-labelledby={title} fill="none">
    <title id={title}>{label}</title>
    <ellipse cx="150" cy="231" rx="131" ry="11" fill="#E9CBAE" />
    {children}
  </svg>;
}

export function HomeIllustration({label}: {label: string}) {
  return <Scene label={label}>
    <rect x="65" y="93" width="177" height="132" rx="12" fill="#FFF9ED" stroke="#D5B495" strokeWidth="3" />
    <path d="M45 99L151 24L260 99Z" fill="#C94158" />
    <path d="M199 57V30H220V72" fill="#B3765F" />
    <rect x="132" y="149" width="39" height="75" rx="5" fill="#99715D" />
    <circle cx="161" cy="187" r="3" fill="#F2D2A5" />
    {[82,185].map(x => <g key={x}><rect x={x} y="121" width="37" height="43" rx="5" fill="#9ED4CA" /><path d={`M${x+18} 125V160M${x+4} 142H${x+33}`} stroke="#70AA99" strokeWidth="2" /></g>)}
    <path d="M30 224V173" stroke="#8C9C6A" strokeWidth="6" strokeLinecap="round" />
    <circle cx="30" cy="157" r="24" fill="#A8CBA1" />
    <rect x="248" y="205" width="25" height="21" rx="4" fill="#C9826D" />
    <path d="M260 206V177M260 193L249 184M260 191L271 182" stroke="#7C9C6C" strokeWidth="4" strokeLinecap="round" />
    <path d="M122 232L132 224H171L184 232" fill="#D8B692" />
  </Scene>;
}

export function InteriorIllustration({label}: {label: string}) {
  return <Scene label={label}>
    <path d="M28 39H273V215H28Z" fill="#FFF9ED" stroke="#DBB798" strokeWidth="3" />
    <path d="M28 215L46 193H252L273 215" fill="#EAD6BD" />
    <rect x="56" y="59" width="70" height="62" rx="7" fill="#9ED4CA" />
    <path d="M91 62V117M60 89H122" stroke="#70AA99" strokeWidth="3" />
    <path d="M59 166V144Q59 135 68 135H178Q188 135 188 144V166" fill="#9ABAA1" />
    <rect x="47" y="153" width="153" height="39" rx="11" fill="#76A18F" />
    <path d="M59 192V203M188 192V203" stroke="#496877" strokeWidth="7" />
    <path d="M73 165H114M130 165H173" stroke="#DBEEE5" strokeWidth="3" strokeLinecap="round" />
    <rect x="200" y="66" width="47" height="68" rx="5" fill="#F3DECB" />
    <circle cx="223" cy="89" r="10" fill="#C9826D" />
    <path d="M208 124L221 102L239 124" fill="#8CAD8B" />
    <path d="M225 193V159" stroke="#99715D" strokeWidth="5" />
    <path d="M207 160L215 139H236L244 160Z" fill="#E9C496" />
    <ellipse cx="141" cy="215" rx="75" ry="8" fill="#D8B692" />
    <path d="M98 206H177M109 207V218M166 207V218" stroke="#B3765F" strokeWidth="5" strokeLinecap="round" />
  </Scene>;
}

export function NeighborhoodIllustration({label}: {label: string}) {
  return <Scene label={label}>
    <path d="M19 204H281V225H19Z" fill="#DBB798" />
    <path d="M21 213H280" stroke="#FFF9ED" strokeWidth="2" strokeDasharray="10 12" />
    <rect x="30" y="80" width="66" height="119" rx="7" fill="#C9826D" />
    {[48,72].flatMap(x => [98,126,154].map(y => <rect key={x+":"+y} x={x} y={y} width="13" height="17" rx="2" fill="#F7E9CC" />))}
    <rect x="113" y="131" width="83" height="68" rx="6" fill="#FFF9ED" stroke="#D5B495" strokeWidth="2" />
    <path d="M105 137H204L192 111H117Z" fill="#C94158" />
    <rect x="126" y="150" width="27" height="28" rx="3" fill="#9ED4CA" />
    <rect x="165" y="149" width="18" height="50" rx="3" fill="#99715D" />
    <path d="M242 198V127" stroke="#8C9C6A" strokeWidth="6" strokeLinecap="round" />
    <circle cx="241" cy="105" r="31" fill="#A8CBA1" />
    <circle cx="263" cy="129" r="22" fill="#91BE91" />
    <path d="M126 69Q126 49 147 49Q169 49 169 69Q169 86 147 101Q126 86 126 69Z" fill="#355D57" />
    <circle cx="147" cy="69" r="8" fill="#FFF9ED" />
  </Scene>;
}

export function ProfileIllustration({label}: {label: string}) {
  return <Scene label={label}>
    <rect x="35" y="50" width="225" height="156" rx="17" fill="#FFF9ED" stroke="#D5B495" strokeWidth="3" />
    <path d="M35 67Q35 50 52 50H243Q260 50 260 67V83H35Z" fill="#355D57" />
    <rect x="63" y="104" width="70" height="77" rx="10" fill="#DBEEE5" />
    <circle cx="98" cy="130" r="17" fill="#EABB94" />
    <path d="M81 130Q73 107 96 107Q121 109 115 133L106 120L83 126" fill="#63504A" />
    <path d="M73 181V164Q97 143 123 164V181" fill="#87AE91" />
    <path d="M151 117H229M151 138H213M151 160H225M151 178H195" stroke="#A7B9A8" strokeWidth="6" strokeLinecap="round" />
    <path d="M222 209L240 191L253 204L235 222L216 228Z" fill="#C94158" />
    <path d="M216 228L219 213L231 225Z" fill="#E9C496" />
    <rect x="117" y="37" width="60" height="28" rx="8" fill="#E9C496" />
  </Scene>;
}
