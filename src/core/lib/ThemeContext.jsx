import React, {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  MIDIA_SISTEMA_ESCURO, TEMA_PADRAO, espelhoDoDispositivo, lerEscolhaDeTema, normalizarTema,
  salvarEscolhaDeTema, temaDisponivel, temaEfetivo,
} from '@/core/theme/themePreference';
import { aplicarTema, gravarEspelho } from '@/core/theme/themeDom';

/**
 * O MODO ESCURO na árvore — quem decide e quem aplica.
 *
 * Um provedor só, logo abaixo da autenticação e das flags (`App.jsx`). As
 * telas não sabem que ele existe: escrevem as classes de sempre, e a paleta
 * (`core/theme/palette.js`) decide a cor. Só o seletor de aparência usa o
 * `useTheme()`.
 *
 * A ordem das coisas numa abertura:
 *  1. o script de `index.html` já pintou a primeira tela pelo espelho do
 *     aparelho (sem clarão);
 *  2. enquanto login e flags carregam, NADA muda — decidir antes seria
 *     piscar para o claro e voltar para o escuro;
 *  3. carregados, a escolha da PESSOA (por uid) vale, e o espelho é
 *     reescrito — ou apagado, quando o escuro não pode valer (flag
 *     desligada, visitante).
 *
 * E as telas que ficam CLARAS de propósito — o telão, o totem, a impressão —
 * entram envolvidas em `<AparenciaClara>`: enquanto uma delas está montada, o
 * documento inteiro fica no claro (o corpo, os diálogos, os avisos), sem
 * mexer na escolha da pessoa.
 */

const ThemeContext = createContext({
  disponivel: false,
  escolha: TEMA_PADRAO,
  efetivo: 'claro',
  setEscolha: () => {},
  forcarClaro: () => () => {},
});

/** O aparelho está no escuro? (acompanha a mudança, para o automático) */
function useSistemaEscuro() {
  const consulta = () => {
    try {
      return Boolean(window.matchMedia?.(MIDIA_SISTEMA_ESCURO)?.matches);
    } catch {
      return false;
    }
  };
  const [escuro, setEscuro] = useState(consulta);
  useEffect(() => {
    let midia;
    try {
      midia = window.matchMedia?.(MIDIA_SISTEMA_ESCURO);
    } catch {
      midia = null;
    }
    if (!midia) return undefined;
    const aoMudar = (e) => setEscuro(Boolean(e.matches));
    // Safari < 14 só tem addListener.
    if (midia.addEventListener) midia.addEventListener('change', aoMudar);
    else midia.addListener?.(aoMudar);
    return () => {
      if (midia.removeEventListener) midia.removeEventListener('change', aoMudar);
      else midia.removeListener?.(aoMudar);
    };
  }, []);
  return escuro;
}

export function ThemeProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { flags, isLoading: carregandoFlags } = useFeatureFlags();
  const uid = user?.uid || null;
  const ligado = Boolean(flags?.[FEATURE_FLAG.DARK_MODE]);
  const autenticado = Boolean(isAuthenticated && uid);
  const sistemaEscuro = useSistemaEscuro();

  // A escolha salva acompanha a CONTA: trocou de pessoa, relê.
  const [escolhaSalva, setEscolhaSalva] = useState(() => ({ uid, escolha: lerEscolhaDeTema(uid) }));
  const escolha = escolhaSalva.uid === uid ? escolhaSalva.escolha : lerEscolhaDeTema(uid);
  useEffect(() => {
    if (escolhaSalva.uid !== uid) setEscolhaSalva({ uid, escolha: lerEscolhaDeTema(uid) });
  }, [uid, escolhaSalva.uid]);

  // Quantas telas "sempre claras" estão montadas agora (ver AparenciaClara).
  const [claroForcado, setClaroForcado] = useState(0);
  const forcarClaro = useCallback(() => {
    setClaroForcado((n) => n + 1);
    return () => setClaroForcado((n) => Math.max(0, n - 1));
  }, []);

  const pronto = !isLoadingAuth && !carregandoFlags;
  const ctx = { ligado, autenticado, escolha, sistemaEscuro };
  const efetivo = claroForcado > 0 ? 'claro' : temaEfetivo(ctx);

  // `useLayoutEffect`: a troca acontece antes da pintura — ao entrar no telão
  // pela navegação, nem um quadro sai escuro.
  useLayoutEffect(() => {
    if (!pronto && claroForcado === 0) return;
    aplicarTema(efetivo);
  }, [pronto, efetivo, claroForcado]);

  // O espelho guarda a ESCOLHA: o telão aberto não a apaga.
  useEffect(() => {
    if (!pronto) return;
    gravarEspelho(espelhoDoDispositivo({ ligado, autenticado, escolha }));
  }, [pronto, ligado, autenticado, escolha]);

  const setEscolha = useCallback((valor) => {
    const nova = normalizarTema(valor);
    if (!nova || !uid) return;
    salvarEscolhaDeTema(uid, nova);
    setEscolhaSalva({ uid, escolha: nova });
    // Aplica JÁ, dentro do esmaecer: esperar o efeito do React tiraria a
    // troca de dentro da transição. O efeito depois confere e não repete.
    if (pronto) {
      if (claroForcado === 0) {
        aplicarTema(temaEfetivo({ ligado, autenticado, escolha: nova, sistemaEscuro }), { animar: true });
      }
      gravarEspelho(espelhoDoDispositivo({ ligado, autenticado, escolha: nova }));
    }
  }, [uid, pronto, ligado, autenticado, sistemaEscuro, claroForcado]);

  const value = useMemo(() => ({
    disponivel: temaDisponivel({ ligado, autenticado }),
    escolha,
    efetivo,
    setEscolha,
    forcarClaro,
  }), [ligado, autenticado, escolha, efetivo, setEscolha, forcarClaro]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Uma tela que fica CLARA mesmo no modo escuro: o telão e o totem (escuros de
 * propósito, desenhados sobre os tokens claros — no modo escuro o `bg-ink`
 * deles viraria ardósia) e a impressão (a tela mostra o que sai no papel).
 *
 * Duas camadas, de propósito: a classe `tema-claro` vale desde o primeiro
 * quadro, e o registro no provedor põe o DOCUMENTO inteiro no claro (corpo,
 * diálogos em portal, avisos). O script de `index.html` também pula estas
 * rotas (`ROTA_SEMPRE_CLARA`), para a abertura direta não sair escura.
 */
export function AparenciaClara({ children }) {
  const { forcarClaro } = useContext(ThemeContext);
  useLayoutEffect(() => forcarClaro(), [forcarClaro]);
  return <div className="tema-claro contents">{children}</div>;
}

/**
 * A aparência para o SELETOR: se o escuro está disponível para esta pessoa,
 * a escolha dela, o que vale agora e como trocar.
 * @returns {{ disponivel: boolean, escolha: 'claro'|'escuro'|'automatico', efetivo: 'claro'|'escuro', setEscolha: (t: string) => void }}
 */
export function useTheme() {
  return useContext(ThemeContext);
}
