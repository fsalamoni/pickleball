/**
 * PlacementGuide — onde pôr ESTA câmera (desenho + onde, altura, para onde
 * aponta) e as dicas do aparelho: celular, webcam, câmera de ação, câmera
 * Wi-Fi. É o que a pessoa lê com o tripé na mão.
 */

import React from 'react';
import { MapPin, ArrowUpFromLine, Crosshair, Smartphone, Webcam, Video, Wifi } from 'lucide-react';
import { CAMERA_POSITIONS } from '@/modules/linecall/domain/cameraLayouts';
import { CAMERA_MIN, CAMERA_GOOD } from '@/modules/linecall/domain/cameraCheck';
import CourtDiagram from './CourtDiagram';
import { t, tk } from '@/core/i18n';

const DEVICE_TIPS = [
  {
    icon: Smartphone,
    title: tk('Celular ou tablet'),
    items: [
      tk('Abra este endereço no Chrome (Android) ou no Safari (iPhone) e entre com a sua conta — pode ser a mesma conta em vários aparelhos.'),
      tk('Use a câmera traseira. Se o aparelho tiver lente grande-angular (0,5×), ela aparece na lista de câmeras: use-a só se a quadra não couber na normal, e confira se as linhas desenhadas batem com as da quadra.'),
      tk('Tripé ou suporte firme, celular na horizontal, na tomada ou com bateria externa, e a tela ligada (o PickleRush mantém a tela acesa). Tire a capa se ela tampar a lente.'),
      tk('Precisa de internet só para mandar as marcações à central (pouquíssimos dados — o vídeo não sai do aparelho).'),
    ],
  },
  {
    icon: Webcam,
    title: tk('Webcam USB no notebook'),
    items: [
      tk('Prefira uma que entregue 60 quadros por segundo em 1080p. Cabo USB longo ou extensão USB ativa para chegar ao alto.'),
      tk('Um notebook pode abrir uma câmera por aba: com duas webcams, abra esta página em duas abas e escolha uma posição em cada.'),
    ],
  },
  {
    icon: Video,
    title: tk('Câmera de ação (GoPro, DJI, Insta360) ou filmadora'),
    items: [
      tk('Ligue no modo webcam pelo USB (GoPro Hero 8 ou mais nova, DJI Osmo Action 3 ou mais nova) ou pela saída HDMI com uma placa de captura HDMI-USB.'),
      tk('Use a lente LINEAR (sem olho de peixe): a lente curva entorta as linhas e a conta da quadra erra nas bordas. 60 quadros, 1080p.'),
    ],
  },
  {
    icon: Wifi,
    title: tk('Câmera Wi-Fi (IP, RTSP)'),
    items: [
      tk('O navegador não abre câmera Wi-Fi direto. No computador, abra a câmera no OBS Studio (gratuito) e ligue a "Câmera virtual": ela aparece aqui como uma webcam. Bluetooth não transmite vídeo.'),
    ],
  },
];

export function DeviceTips() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DEVICE_TIPS.map(({ icon: Icon, title, items }) => (
        <div key={title} className="rounded-2xl border border-gray-100 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon className="h-4 w-4" aria-hidden="true" /> {t(title)}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-gray-600">
            {items.map((i) => <li key={i}>{t(i)}</li>)}
          </ul>
        </div>
      ))}
      <p className="text-xs leading-5 text-gray-500 sm:col-span-2">
        {t('Mínimo: {f} quadros por segundo e {r}p. O bom: {f2} quadros e {r2}p. Quanto mais quadros, menor a faixa de "revisar". Luz boa, sem a câmera contra o sol, e bola de cor viva.', { f: CAMERA_MIN.fps, r: CAMERA_MIN.height, f2: CAMERA_GOOD.fps, r2: CAMERA_GOOD.height })}
      </p>
    </div>
  );
}

/** @param {{ position: string, layoutPositions: string[] }} props */
export default function PlacementGuide({ position, layoutPositions }) {
  const p = CAMERA_POSITIONS[position];
  if (!p) return null;
  const rows = [
    { icon: MapPin, label: t('Onde'), text: t(p.where) },
    { icon: ArrowUpFromLine, label: t('Altura'), text: t(p.height) },
    { icon: Crosshair, label: t('Para onde aponta'), text: t(p.aim) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
      <CourtDiagram
        positions={layoutPositions}
        active={position}
        className="mx-auto w-full max-w-[180px] text-ink"
        label={t('A posição desta câmera no desenho da quadra: {p}', { p: t(p.label) })}
      />
      <div className="space-y-3">
        <dl className="space-y-2">
          {rows.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex gap-2 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              <div>
                <dt className="font-semibold text-ink">{label}</dt>
                <dd className="text-gray-600">{text}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-5 text-gray-500">
          {t('Combine com quem está nas outras câmeras qual é o lado A da quadra (por exemplo, o lado da entrada). Todos os aparelhos usam o mesmo desenho.')}
        </p>
      </div>
    </div>
  );
}
