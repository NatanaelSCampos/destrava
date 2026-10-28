import { useId } from "react";
/** Decorative, language-neutral journey artwork. Learning stimuli remain in the lessons. */
export function TrailArtwork({ compact = false }: { compact?: boolean }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 420 280"
      className={compact ? "tv-art compact" : "tv-art"}
      role="img"
      aria-labelledby={id}
      fill="none"
    >
      <title id={id}>Uma jornada entre conversas, descobertas e novos desafios</title>
      <circle cx="241" cy="129" r="115" fill="#F8E5CA" />
      <circle cx="332" cy="70" r="20" fill="#D7E9DE" />
      <path
        d="M35 238C39 191 165 244 166 183S302 184 303 123S369 94 376 42"
        stroke="#D8BFA5"
        strokeWidth="5"
        strokeDasharray="2 12"
        strokeLinecap="round"
      />
      <rect
        x="42"
        y="106"
        width="118"
        height="112"
        rx="22"
        fill="#FFFDF7"
        stroke="#E3C9AC"
        strokeWidth="2"
      />
      <rect x="61" y="125" width="78" height="35" rx="12" fill="#D7E9DE" />
      <path d="M73 138H125M73 147H110" stroke="#527E6C" strokeWidth="4" strokeLinecap="round" />
      <path d="M70 157L66 169L84 158" fill="#D7E9DE" />
      <rect x="78" y="174" width="64" height="25" rx="10" fill="#F4D4CA" />
      <path d="M88 186H129" stroke="#BF6B62" strokeWidth="4" strokeLinecap="round" />
      <g transform="rotate(8 239 111)">
        <rect x="189" y="52" width="104" height="120" rx="19" fill="#355D55" />
        <path d="M207 74H272V149H207Z" fill="#FAF3DF" />
        <path
          d="M222 90H258M222 103H255M222 116H244"
          stroke="#A3BC9A"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M243 140L253 130L263 140" stroke="#B32638" strokeWidth="3" />
      </g>
      <path d="M333 135V211" stroke="#5A7768" strokeWidth="6" strokeLinecap="round" />
      <path d="M336 139C352 129 363 146 385 133V169C364 182 353 164 336 175Z" fill="#C54359" />
      <ellipse cx="260" cy="243" rx="114" ry="11" fill="#E7CFB3" />
      <circle cx="201" cy="208" r="17" fill="#E9B68C" />
      <path d="M185 208C181 188 204 182 216 201L214 213L207 199L188 202" fill="#63504A" />
      <path d="M175 244V231Q199 209 223 232V244" fill="#83A88C" />
      <circle cx="276" cy="197" r="16" fill="#E9B68C" />
      <path d="M261 199C253 178 281 173 292 193L290 205L280 189L263 195" fill="#63504A" />
      <path d="M253 243V218Q276 202 299 220V243" fill="#C57D68" />
      <circle cx="54" cy="72" r="5" fill="#B32638" />
      <path
        d="M132 49V63M125 56H139M357 230V244M350 237H364"
        stroke="#799B83"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
