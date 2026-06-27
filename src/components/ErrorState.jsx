import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Estado de erro consistente para listas/consultas que falharam. Substitui o
 * antigo comportamento de "falhar para vazio" (que confundia o usuário) por uma
 * mensagem clara com opção de tentar novamente.
 *
 * @param {{ message?: string, onRetry?: () => void }} props
 */
export default function ErrorState({ message = 'Não foi possível carregar os dados agora.', onRetry }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-600">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
        )}
      </CardContent>
    </Card>
  );
}
