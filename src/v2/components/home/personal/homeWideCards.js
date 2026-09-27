/**
 * Quais seções da tela inicial ocupam a linha inteira da grade (um `Set` de
 * ids). O início sob medida decide pela ordem da pessoa (`wideHomeCards`), para
 * não sobrar buraco, e `HomeSection` lê daqui — sem cada seção precisar de uma
 * prop nova. Fora do provedor vale `null`: cada seção decide sozinha, como antes.
 */
import { createContext } from 'react';

export const HomeWideCards = createContext(null);
