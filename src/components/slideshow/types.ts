export interface SlideshowItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  objectPosition: string;
}
