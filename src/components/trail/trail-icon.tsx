import {
  BookOpen,
  MessageCircle,
  MapPin,
  Headphones,
  Brain,
  Clock3,
  Handshake,
  Coffee,
  ShoppingBag,
  Target,
  Flag,
  Trophy,
  Sparkles,
  Compass,
  Play,
  Lightbulb,
} from "lucide-react";
import type { JourneyIcon } from "@/content/journey-presentation";
const icons = {
  "book-open": BookOpen,
  "message-circle": MessageCircle,
  "map-pin": MapPin,
  headphones: Headphones,
  brain: Brain,
  clock: Clock3,
  handshake: Handshake,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  target: Target,
  flag: Flag,
  trophy: Trophy,
  sparkles: Sparkles,
  compass: Compass,
  play: Play,
  lightbulb: Lightbulb,
};
export function TrailIcon({ name, size = 22 }: { name: JourneyIcon; size?: number }) {
  const Icon = icons[name] ?? Compass;
  return <Icon size={size} aria-hidden="true" />;
}
