/** Baixa um texto gerado no navegador como arquivo (nada sai do aparelho). */
export function baixarArquivo(nome, texto, tipo = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
