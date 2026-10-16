import { describe, expect, it, vi } from 'vitest';
import {
  abrirPedidoDeInstalacao, appFoiInstalado, assinarPedidoDeInstalacao,
  capturarPedidoDeInstalacao, lerPedidoDeInstalacao,
} from './pedidoDeInstalacao';

describe('pedido de instalação guardado desde a abertura', () => {
  it('⭐ o evento que chegou ANTES do botão montar continua disponível', async () => {
    const ouv = {};
    capturarPedidoDeInstalacao({ addEventListener: (ev, f) => { ouv[ev] = f; } });
    const evento = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    ouv.beforeinstallprompt(evento);
    expect(evento.preventDefault).toHaveBeenCalled();

    // Só agora "monta" um botão.
    const mudou = vi.fn();
    const sair = assinarPedidoDeInstalacao(mudou);
    expect(lerPedidoDeInstalacao()).toBe(evento);
    expect(await abrirPedidoDeInstalacao()).toBe('accepted');
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(lerPedidoDeInstalacao()).toBeNull(); // não se usa o mesmo evento duas vezes
    expect(await abrirPedidoDeInstalacao()).toBeNull();

    ouv.appinstalled();
    expect(appFoiInstalado()).toBe(true);
    expect(mudou).toHaveBeenCalled();
    sair();
  });
});
