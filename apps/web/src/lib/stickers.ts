import sticker1 from '../assets/stickers/chiikawa/455656342.png';
import sticker2 from '../assets/stickers/chiikawa/455656343.png';
import sticker3 from '../assets/stickers/chiikawa/455656344.png';
import sticker4 from '../assets/stickers/chiikawa/455656345.png';
import sticker5 from '../assets/stickers/chiikawa/455656346.png';
import sticker6 from '../assets/stickers/chiikawa/455656347.png';
import sticker7 from '../assets/stickers/chiikawa/455656348.png';
import sticker8 from '../assets/stickers/chiikawa/455656349.png';
import sticker9 from '../assets/stickers/chiikawa/455656350.png';
import sticker10 from '../assets/stickers/chiikawa/455656351.png';
import sticker11 from '../assets/stickers/chiikawa/455656352.png';
import sticker12 from '../assets/stickers/chiikawa/455656353.png';
import sticker13 from '../assets/stickers/chiikawa/455656354.png';
import sticker14 from '../assets/stickers/chiikawa/455656355.png';
import sticker15 from '../assets/stickers/chiikawa/455656356.png';
import sticker16 from '../assets/stickers/chiikawa/455656357.png';
import sticker17 from '../assets/stickers/chiikawa/455656358.png';
import sticker18 from '../assets/stickers/chiikawa/455656359.png';
import sticker19 from '../assets/stickers/chiikawa/455656360.png';
import sticker20 from '../assets/stickers/chiikawa/455656361.png';
import sticker21 from '../assets/stickers/chiikawa/455656362.png';
import sticker22 from '../assets/stickers/chiikawa/455656363.png';
import sticker23 from '../assets/stickers/chiikawa/455656364.png';
import sticker24 from '../assets/stickers/chiikawa/455656365.png';
import sticker25 from '../assets/stickers/chiikawa/455656366.png';
import sticker26 from '../assets/stickers/chiikawa/455656367.png';
import sticker27 from '../assets/stickers/chiikawa/455656368.png';
import sticker28 from '../assets/stickers/chiikawa/455656369.png';
import sticker29 from '../assets/stickers/chiikawa/455656370.png';
import sticker30 from '../assets/stickers/chiikawa/455656371.png';
import sticker31 from '../assets/stickers/chiikawa/455656372.png';
import sticker32 from '../assets/stickers/chiikawa/455656373.png';
import sticker33 from '../assets/stickers/chiikawa/455656374.png';
import sticker34 from '../assets/stickers/chiikawa/455656375.png';
import sticker35 from '../assets/stickers/chiikawa/455656376.png';
import sticker36 from '../assets/stickers/chiikawa/455656377.png';
import sticker37 from '../assets/stickers/chiikawa/455656378.png';
import sticker38 from '../assets/stickers/chiikawa/455656379.png';
import sticker39 from '../assets/stickers/chiikawa/455656380.png';
import sticker40 from '../assets/stickers/chiikawa/455656381.png';
import { SIGSTICK_PACKS } from './sigstick-packs';

export interface ChatSticker {
  id: string;
  label: string;
  src: string;
  thumbnailSrc?: string;
  body: string;
}

// Los IDs y marcadores permanecen estables para el historial ya guardado.
const LEGACY_CHIIKAWA_STICKERS: readonly ChatSticker[] = [
  { id: '455656342', label: 'Chiikawa · Sí', src: sticker1, body: '[sticker:chiikawa:455656342]' },
  { id: '455656343', label: 'Chiikawa y Hachiware · De acuerdo', src: sticker2, body: '[sticker:chiikawa:455656343]' },
  { id: '455656344', label: 'Chiikawa · Paseo', src: sticker3, body: '[sticker:chiikawa:455656344]' },
  { id: '455656345', label: 'Hachiware · Gracias', src: sticker4, body: '[sticker:chiikawa:455656345]' },
  { id: '455656346', label: 'Chiikawa · Asentir', src: sticker5, body: '[sticker:chiikawa:455656346]' },
  { id: '455656347', label: 'Chiikawa · ¡Hurra!', src: sticker6, body: '[sticker:chiikawa:455656347]' },
  { id: '455656348', label: 'Chiikawa · Buen trabajo', src: sticker7, body: '[sticker:chiikawa:455656348]' },
  { id: '455656349', label: 'Chiikawa · Corazón', src: sticker8, body: '[sticker:chiikawa:455656349]' },
  { id: '455656350', label: 'Hachiware · Sí', src: sticker9, body: '[sticker:chiikawa:455656350]' },
  { id: '455656351', label: 'Hachiware · Sorpresa', src: sticker10, body: '[sticker:chiikawa:455656351]' },
  { id: '455656352', label: 'Hachiware · Cantando', src: sticker11, body: '[sticker:chiikawa:455656352]' },
  { id: '455656353', label: 'Hachiware · Pensando', src: sticker12, body: '[sticker:chiikawa:455656353]' },
  { id: '455656354', label: 'Chiikawa · Flor', src: sticker13, body: '[sticker:chiikawa:455656354]' },
  { id: '455656355', label: 'Chiikawa · A dormir', src: sticker14, body: '[sticker:chiikawa:455656355]' },
  { id: '455656356', label: 'Chiikawa · Sonrisa', src: sticker15, body: '[sticker:chiikawa:455656356]' },
  { id: '455656357', label: 'Chiikawa · ¿Qué?', src: sticker16, body: '[sticker:chiikawa:455656357]' },
  { id: '455656358', label: 'Chiikawa · Por favor', src: sticker17, body: '[sticker:chiikawa:455656358]' },
  { id: '455656359', label: 'Chiikawa · Brillando', src: sticker18, body: '[sticker:chiikawa:455656359]' },
  { id: '455656360', label: 'Chiikawa · Buenos días', src: sticker19, body: '[sticker:chiikawa:455656360]' },
  { id: '455656361', label: 'Amigos · Buenas noches', src: sticker20, body: '[sticker:chiikawa:455656361]' },
  { id: '455656362', label: 'Chiikawa · Abrazo', src: sticker21, body: '[sticker:chiikawa:455656362]' },
  { id: '455656363', label: 'Usagi · A comer', src: sticker22, body: '[sticker:chiikawa:455656363]' },
  { id: '455656364', label: 'Amigos · Corriendo', src: sticker23, body: '[sticker:chiikawa:455656364]' },
  { id: '455656365', label: 'Amigos · Hola', src: sticker24, body: '[sticker:chiikawa:455656365]' },
  { id: '455656366', label: 'Chiikawa y Hachiware · Cariño', src: sticker25, body: '[sticker:chiikawa:455656366]' },
  { id: '455656367', label: 'Usagi · Celebración', src: sticker26, body: '[sticker:chiikawa:455656367]' },
  { id: '455656368', label: 'Usagi · Feliz', src: sticker27, body: '[sticker:chiikawa:455656368]' },
  { id: '455656369', label: 'Momonga · Flores', src: sticker28, body: '[sticker:chiikawa:455656369]' },
  { id: '455656370', label: 'Momonga · Mírame', src: sticker29, body: '[sticker:chiikawa:455656370]' },
  { id: '455656371', label: 'Momonga · Susto', src: sticker30, body: '[sticker:chiikawa:455656371]' },
  { id: '455656372', label: 'Kurimanju · Confía en ti', src: sticker31, body: '[sticker:chiikawa:455656372]' },
  { id: '455656373', label: 'Kurimanju · Comiendo', src: sticker32, body: '[sticker:chiikawa:455656373]' },
  { id: '455656374', label: 'Amigos · Me voy', src: sticker33, body: '[sticker:chiikawa:455656374]' },
  { id: '455656375', label: 'Hachiware · Hasta luego', src: sticker34, body: '[sticker:chiikawa:455656375]' },
  { id: '455656376', label: 'Chiikawa · Ya llegué', src: sticker35, body: '[sticker:chiikawa:455656376]' },
  { id: '455656377', label: 'Usagi · Bienvenido', src: sticker36, body: '[sticker:chiikawa:455656377]' },
  { id: '455656378', label: 'Shisa · ¡Ya llegué!', src: sticker37, body: '[sticker:chiikawa:455656378]' },
  { id: '455656379', label: 'Pájaro · Hola', src: sticker38, body: '[sticker:chiikawa:455656379]' },
  { id: '455656380', label: 'Kappa · Sonrisa', src: sticker39, body: '[sticker:chiikawa:455656380]' },
  { id: '455656381', label: 'Chiikawa y Momonga · Monocromo', src: sticker40, body: '[sticker:chiikawa:455656381]' },
];

export interface ChatStickerPack {
  id: string;
  label: string;
  coverSrc: string;
  stickers: readonly ChatSticker[];
}

// El pack Chiikawa ちいかわ va primero por elección del usuario. El catálogo
// original sigue disponible y conserva cada marcador del historial.
export const CHIIKAWA_PACKS: readonly ChatStickerPack[] = [
  ...SIGSTICK_PACKS,
  { id: 'chiikawa-4', label: 'Chiikawa 4', coverSrc: sticker1, stickers: LEGACY_CHIIKAWA_STICKERS },
];
export const CHIIKAWA_STICKERS: readonly ChatSticker[] = CHIIKAWA_PACKS.flatMap((pack) => pack.stickers);

const stickersByBody = new Map(CHIIKAWA_STICKERS.map((sticker) => [sticker.body, sticker]));

// Sólo una coincidencia completa del catálogo se representa como sticker.
export function getMessageSticker(body: string): ChatSticker | undefined {
  return stickersByBody.get(body);
}
