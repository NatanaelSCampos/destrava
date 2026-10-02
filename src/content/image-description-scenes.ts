export type ImageDescriptionScene = {
  id: string;
  title: string;
  image: string;
  alt: string;
  prompt: string;
  facts: string[];
};

export const imageDescriptionScenes: ImageDescriptionScene[] = [
  {
    id: "kitchen",
    title: "Na cozinha",
    image: "/images/description/cozinha.png",
    alt: "Uma mulher e uma criança em uma cozinha com maçãs e um gato.",
    prompt: "O que você vê? Quem está lá e o que estão fazendo?",
    facts: [
      "cozinha ensolarada",
      "mulher cortando maçã",
      "criança segurando maçã",
      "gato no chão",
      "maçãs sobre a mesa",
      "janela grande",
    ],
  },
  {
    id: "cafe",
    title: "No café",
    image: "/images/description/cafe.png",
    alt: "Um garçom e uma cliente na mesa de um café, perto de uma bicicleta.",
    prompt: "Descreva as pessoas, o lugar e os objetos que você observa.",
    facts: [
      "terraço de café",
      "garçom com avental",
      "mulher tomando café",
      "xícara branca",
      "bicicleta estacionada",
      "plantas",
      "toldo vermelho",
    ],
  },
];

export function findImageDescriptionScene(id: string) {
  return imageDescriptionScenes.find((scene) => scene.id === id);
}
