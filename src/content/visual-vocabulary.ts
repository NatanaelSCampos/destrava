export type VisualCue = {
  icon: "home" | "work" | "talk" | "doctor" | "teacher" | "location";
  alt: string;
};

// Simple pictograms are used only where a single A1 concept can be shown clearly.
export const visualVocabulary: Record<string, VisualCue> = {
  vivir: { icon: "home", alt: "Desenho de uma casa" },
  trabajar: { icon: "work", alt: "Desenho de uma maleta de trabalho" },
  hablar: { icon: "talk", alt: "Desenho de um balão de conversa" },
  medico: { icon: "doctor", alt: "Desenho de um estetoscópio" },
  profesor: { icon: "teacher", alt: "Desenho de uma pessoa ensinando" },
  donde: { icon: "location", alt: "Desenho de um marcador de localização" },
};

export const reviewClozeForms: Record<string, string[]> = {
  llamarse: ["me llamo"],
  tener: ["tengo"],
  vivir: ["vivo"],
  trabajar: ["trabajo"],
  hablar: ["hablo"],
};
