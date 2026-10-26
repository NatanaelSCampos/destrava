import { useId } from "react";

export function PlaceIllustration({ label, small = false }: { label: string; small?: boolean }) {
  const title = useId();
  return <svg className={small ? "place-illustration small" : "place-illustration"} viewBox="0 0 360 280" fill="none" role="img" aria-labelledby={title}>
    <title id={title}>{label}: um lugar para encontrar alguém</title>
    <ellipse cx="184" cy="258" rx="160" ry="17" fill="#E9CBAE" />
    <path d="M20 253C52 225 73 253 107 241C143 224 166 248 191 240C237 219 278 244 338 242V270H20Z" fill="#E7C5A3" />
    <rect x="78" y="89" width="216" height="155" rx="13" fill="#FFFCF5" stroke="#D5B495" strokeWidth="3"/>
    <path d="M64 91L186 37L309 91Z" fill="#C94158"/><path d="M80 91H293" stroke="#AD344A" strokeWidth="5"/>
    <rect x="118" y="67" width="138" height="32" rx="8" fill="#FFF5E9" stroke="#D7B99C" strokeWidth="2"/>
    <text x="187" y="88" textAnchor="middle" fill="#805D48" fontSize={label.length > 17 ? "10" : "13"} fontWeight="700" fontFamily="system-ui,sans-serif">{label}</text>
    <rect x="96" y="117" width="67" height="74" rx="7" fill="#9ED4CA"/><path d="M106 127H153V181H106Z" fill="#CDECE3"/>
    <path d="M129 127V181M106 154H153" stroke="#78B7A8" strokeWidth="3"/>
    <rect x="211" y="117" width="65" height="74" rx="7" fill="#9ED4CA"/><path d="M221 127H266V181H221Z" fill="#CDECE3"/>
    <path d="M244 127V181M221 154H266" stroke="#78B7A8" strokeWidth="3"/>
    <path d="M175 149Q187 139 199 149V243H175Z" fill="#99715D"/><circle cx="193" cy="198" r="3" fill="#F0D6AB"/>
    <path d="M71 246H302" stroke="#C7A387" strokeWidth="5" strokeLinecap="round"/>
    <path d="M35 247V203" stroke="#8C9C6A" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="36" cy="186" r="27" fill="#91BE91"/><circle cx="24" cy="198" r="19" fill="#A8CBA1"/>
    <rect x="301" y="226" width="28" height="24" rx="4" fill="#C9826D"/><path d="M315 227V192M315 207L303 198M315 211L328 200" stroke="#7C9C6C" strokeWidth="5" strokeLinecap="round"/>
    <path d="M97 252L106 228L132 229L140 252" fill="#476A75"/><path d="M105 230V204Q120 190 134 204L137 230" fill="#6EA991"/>
    <circle cx="119" cy="184" r="15" fill="#E7AD87"/><path d="M104 181Q103 164 119 164Q138 166 134 184L126 176L109 179" fill="#6B5147"/>
    <path d="M134 208L147 194" stroke="#E7AD87" strokeWidth="8" strokeLinecap="round"/>
    <rect x="142" y="180" width="13" height="22" rx="3" fill="#304954"/><path d="M146 183H151V195H146Z" fill="#D8EEE5"/>
    <path d="M55 255C61 244 69 239 74 246" stroke="#C99C79" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

export function ConversationAvatar({ alternate = false }: { alternate?: boolean }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect width="48" height="48" rx="16" fill={alternate ? "#DBEEE5" : "#F3DECB"}/>
    <path d="M9 48V40C11 29 36 29 39 40V48" fill={alternate ? "#709E8C" : "#C57D68"}/>
    <circle cx="24" cy="22" r="12" fill="#EABB94"/>
    <path d={alternate ? "M12 23C6 10 21 3 31 11C38 12 37 22 34 25L30 16L14 19Z" : "M12 22C8 10 20 5 29 9C39 12 36 23 35 24L28 15L13 18Z"} fill="#63504A"/>
    <circle cx="20" cy="23" r="1" fill="#63504A"/><circle cx="28" cy="23" r="1" fill="#63504A"/>
    <path d="M21 28Q24 30 27 28" stroke="#AA705B" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}

export function MessageIllustration() {
  return <svg className="message-illustration" viewBox="0 0 160 110" fill="none" aria-hidden="true">
    <ellipse cx="83" cy="102" rx="67" ry="6" fill="#EAD6BD" />
    <rect x="62" y="10" width="57" height="91" rx="11" fill="#355D57" />
    <rect x="67" y="18" width="47" height="72" rx="6" fill="#FFF8EC" />
    <path d="M81 13H100" stroke="#C8DED4" strokeWidth="3" strokeLinecap="round" />
    <rect x="73" y="31" width="32" height="15" rx="6" fill="#D9EDE2" />
    <path d="M78 37H99M78 41H93" stroke="#75A58E" strokeWidth="2" strokeLinecap="round" />
    <rect x="80" y="52" width="27" height="15" rx="6" fill="#F2D5CB" />
    <path d="M85 58H102M85 62H97" stroke="#C3796E" strokeWidth="2" strokeLinecap="round" />
    <circle cx="91" cy="95" r="2.5" fill="#C8DED4" />
    <circle cx="38" cy="52" r="12" fill="#E7AD87" />
    <path d="M26 50C21 35 42 33 49 45L47 54L40 45L27 47" fill="#6B5147" />
    <path d="M21 94V76C24 63 49 64 52 77L50 96" fill="#87AE91" />
    <path d="M49 78L63 66" stroke="#E7AD87" strokeWidth="7" strokeLinecap="round" />
    <path d="M21 95L17 104M45 95L49 104" stroke="#496877" strokeWidth="8" strokeLinecap="round" />
    <path d="M129 46Q139 35 146 47M130 56Q140 45 149 58" stroke="#C58B70" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}


export function ClockIllustration({ hour, minute, label }: {hour?: number; minute?: number; label: string}) {
  const title = useId();
  return <svg className="scene-illustration clock-illustration" viewBox="0 0 240 210" role="img" aria-labelledby={title} fill="none">
    <title id={title}>{label}</title>
    <ellipse cx="120" cy="194" rx="87" ry="9" fill="#E9CBAE" />
    <rect x="27" y="21" width="186" height="174" rx="38" fill="#B3765F" />
    <circle cx="120" cy="103" r="76" fill="#FFF9ED" stroke="#E5C6A3" strokeWidth="5" />
    {Array.from({length: 12}, (_, i) => <g key={i} transform={"rotate(" + i * 30 + " 120 103)"}><path d="M120 38V44" stroke="#AE8E70" strokeWidth="3" strokeLinecap="round" /></g>)}
    <text x="120" y="59" textAnchor="middle" fill="#735846" fontSize="13" fontWeight="700">12</text>
    <text x="173" y="108" textAnchor="middle" fill="#735846" fontSize="13" fontWeight="700">3</text>
    <text x="120" y="160" textAnchor="middle" fill="#735846" fontSize="13" fontWeight="700">6</text>
    <text x="67" y="108" textAnchor="middle" fill="#735846" fontSize="13" fontWeight="700">9</text>
    {hour !== undefined && minute !== undefined && <><path d="M120 103V67" stroke="#355D57" strokeWidth="7" strokeLinecap="round" transform={"rotate(" + ((hour % 12) * 30 + minute / 2) + " 120 103)"} />
    <path d="M120 103V49" stroke="#C94158" strokeWidth="4" strokeLinecap="round" transform={"rotate(" + minute * 6 + " 120 103)"} />
    <circle cx="120" cy="103" r="6" fill="#355D57" /></>}
  </svg>;
}

function CafeIllustration({ label, takeaway = false, menu = false }: {label: string; takeaway?: boolean; menu?: boolean}) {
  const title = useId();
  return <svg className="scene-illustration cafe-illustration" viewBox="0 0 300 250" fill="none" role="img" aria-labelledby={title}>
    <title id={title}>{label}</title>
    <ellipse cx="151" cy="228" rx="132" ry="13" fill="#E9CBAE" />
    <rect x="39" y="38" width="222" height="173" rx="17" fill="#FFF9ED" stroke="#DBB798" strokeWidth="3" />
    <path d="M28 43H272L253 17H46Z" fill="#C94158" />
    {[0,1,2,3,4,5].map(i => <path key={i} d={"M" + (30+i*40) + " 43h40v16q-20 18-40 0Z"} fill={i%2 ? "#F4D6BD" : "#D65B6C"} />)}
    <rect x="57" y="76" width="87" height="91" rx="7" fill="#355D57" />
    <path d="M69 91H129M69 103H111M69 116H129M69 130H118M69 144H129" stroke="#C6DFCA" strokeWidth="3" strokeLinecap="round" />
    {menu ? <><rect x="166" y="81" width="68" height="94" rx="7" fill="#FAE8C9" /><path d="M180 99H220M180 116H209M180 133H220M180 150H211" stroke="#B3765F" strokeWidth="3" strokeLinecap="round" /></> : <><rect x="168" y="76" width="68" height="76" rx="7" fill="#B2D8C9" /><path d="M202 77V151M169 115H235" stroke="#81B6A4" strokeWidth="3" /></>}
    <path d="M34 184H267V215H34Z" fill="#B3765F" /><path d="M31 182H270" stroke="#8B5F4D" strokeWidth="8" strokeLinecap="round" />
    {takeaway ? <><path d="M179 138H228L223 182H185Z" fill="#F2D2A5" /><path d="M191 143V132Q203 116 215 132V143" stroke="#B3765F" strokeWidth="4" /><path d="M102 141H134L131 180H107Z" fill="#F9F1DC" /><path d="M99 141H138" stroke="#355D57" strokeWidth="6" strokeLinecap="round" /></> : <><path d="M162 145H204V159Q202 180 184 179Q164 180 162 159Z" fill="#DBEEE5" stroke="#81B6A4" strokeWidth="3" /><path d="M205 148Q228 143 224 158Q220 167 205 165" stroke="#81B6A4" strokeWidth="4" /><path d="M154 181H216" stroke="#FFF1D7" strokeWidth="5" strokeLinecap="round" /><path d="M175 130Q168 122 177 112M191 130Q184 121 194 111" stroke="#C5A286" strokeWidth="3" strokeLinecap="round" /></>}
    <circle cx="86" cy="155" r="16" fill="#E7AD87" /><path d="M70 155Q65 135 87 135Q103 136 102 153L91 144L74 149" fill="#6B5147" />
    <path d="M64 212V190Q85 174 108 191V212" fill="#87AE91" />
    <path d="M113 214V229M61 213V229" stroke="#496877" strokeWidth="9" strokeLinecap="round" />
  </svg>;
}

function MeetingIllustration({ label }: {label: string}) {
  const title = useId();
  return <svg className="scene-illustration meeting-illustration" viewBox="0 0 260 230" fill="none" role="img" aria-labelledby={title}>
    <title id={title}>{label}</title>
    <ellipse cx="130" cy="211" rx="112" ry="13" fill="#E9CBAE" />
    <path d="M26 187H235" stroke="#C5A286" strokeWidth="4" strokeLinecap="round" />
    <path d="M180 180V69" stroke="#96765E" strokeWidth="7" strokeLinecap="round" />
    <circle cx="181" cy="59" r="34" fill="#99BE97" /><circle cx="207" cy="90" r="26" fill="#B3CFA4" />
    <rect x="39" y="163" width="132" height="13" rx="5" fill="#B3765F" /><path d="M55 173V202M155 173V202" stroke="#735846" strokeWidth="7" />
    <circle cx="78" cy="107" r="20" fill="#E7AD87" /><path d="M58 105Q54 79 78 80Q104 81 98 109L88 94L61 99" fill="#6B5147" />
    <path d="M54 170V143Q73 123 101 143L105 171" fill="#87AE91" />
    <path d="M63 170L56 206M94 171L99 206" stroke="#496877" strokeWidth="11" strokeLinecap="round" />
    <circle cx="148" cy="105" r="19" fill="#ECC099" /><path d="M128 105Q121 78 147 78Q172 80 168 106L153 90L132 97" fill="#63504A" />
    <path d="M126 168V140Q146 123 168 141L173 170" fill="#C57D68" />
    <path d="M132 170L129 205M162 172L170 205" stroke="#496877" strokeWidth="11" strokeLinecap="round" />
    <path d="M99 145L119 133M127 142L118 132" stroke="#E7AD87" strokeWidth="9" strokeLinecap="round" />
    <path d="M99 48H140Q149 48 149 57V72Q149 81 139 81H119L110 91V81H99Q90 81 90 72V57Q90 48 99 48Z" fill="#FFF9ED" stroke="#DBB798" strokeWidth="2" />
    <circle cx="105" cy="64" r="2.5" fill="#C94158" /><circle cx="119" cy="64" r="2.5" fill="#C94158" /><circle cx="133" cy="64" r="2.5" fill="#C94158" />
  </svg>;
}

export function SceneIllustration({kind, label, clock}: {
  kind: import("@/content/activity-scene").SceneIllustrationKind; label: string;
  clock?: {hour: number; minute: number};
}) {
  if (kind === "message") return <MessageIllustration />;
  if (kind === "meeting") return <MeetingIllustration label={label} />;
  // A missing authored time must not invent a time that could suggest an answer.
  if (kind === "clock") return <ClockIllustration {...clock} label={label} />;
  return <CafeIllustration label={label} menu={kind === "menu"} takeaway={kind === "takeaway"} />;
}
