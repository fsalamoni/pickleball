/**
 * V2CoachProfile — Perfil público de um professor + lista de arenas
 * onde ele é residente (Sprint 4 PRO-15).
 *
 * Rota: /coaches/:coachId
 */

import React, { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, MapPin, Award, MessageCircle, Plus, Trash2, Video, Phone, Mail, Store, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCoach, useCoachResidencies, useAddCoachResidency, useRemoveCoachResidency } from '@/modules/coaches/hooks/useCoaches';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { canAcceptStudents } from '@/modules/coaches/domain/coach';
import { STUDENT_STATUS } from '@/modules/coaches/domain/student';
import { visibleContent, sortContent, contentCategoryLabel, CONTENT_VISIBILITY } from '@/modules/coaches/domain/content';
import { coachProductCategoryLabel, formatCoachProductPrice } from '@/modules/coaches/domain/coachProduct';
import { useStudentCoaches } from '@/modules/coaches/hooks/useStudents';
import { useCoachContent } from '@/modules/coaches/hooks/useContent';
import { useCoachProducts } from '@/modules/coaches/hooks/useCoachProducts';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import RequestLessonDialog from '@/modules/coaches/components/RequestLessonDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Surface, V2Skeleton,
} from '@/v2/ui/primitives';

function ResidencyCard({ residency, canRemove, onRemove }) {
  const { data: arena } = useArena(residency.arena_id);
  if (!arena) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Link to={`/arenas/${arena.id}`} className="text-sm font-bold text-ink hover:underline">
            {arena.name}
          </Link>
          {arena.city && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="h-3 w-3" /> {arena.city}{arena.state && `, ${arena.state}`}
            </div>
          )}
          {residency.notes && <p className="mt-1 text-xs text-gray-500">{residency.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {residency.status === 'paused' ? <V2Badge tone="amber">Pausado</V2Badge> : <V2Badge tone="green">Ativo</V2Badge>}
          {canRemove && (
            <button onClick={onRemove} className="text-red-500 hover:text-red-700" aria-label="Remover residência">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddResidencyForm({ coachId, onClose }) {
  const { data: myArenas = [] } = useMyManagedArenas();
  const [arenaId, setArenaId] = useState('');
  const [notes, setNotes] = useState('');
  const add = useAddCoachResidency();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!arenaId) {
      toast.error('Selecione uma arena.');
      return;
    }
    try {
      await add.mutateAsync({ coach_id: coachId, arena_id: arenaId, notes });
      toast.success('Residência adicionada!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (myArenas.length === 0) {
    return (
      <V2Surface className="border-amber-200 bg-amber-50/40">
        <p className="text-sm text-amber-800">Você precisa gerenciar pelo menos uma arena para adicionar residência.</p>
      </V2Surface>
    );
  }

  return (
    <V2Surface className="border-green-200 bg-green-50/40">
      <h4 className="font-display text-sm font-bold text-ink">Adicionar residência</h4>
      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <select value={arenaId} onChange={(e) => setArenaId(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" required>
          <option value="">Selecione uma arena...</option>
          {myArenas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}{a.city ? ` (${a.city})` : ''}</option>
          ))}
        </select>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" maxLength={500}
          className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2">
          <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
          <V2Button type="submit" size="sm" disabled={add.isPending}>
            {add.isPending ? 'Adicionando…' : 'Adicionar'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

export default function V2CoachProfile() {
  const { coachId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: coach, isLoading } = useCoach(coachId);
  const { data: residencies = [] } = useCoachResidencies(coachId);
  const remove = useRemoveCoachResidency();
  const [adding, setAdding] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const lessonsOn = useFeatureFlag(FEATURE_FLAG.COACH_LESSONS);

  const isOwn = user?.uid === coachId;
  const isPlatformAdmin = user?.isPlatformAdmin;
  const canRequestLesson = lessonsOn && !isOwn && coach && canAcceptStudents(coach);

  // Relação do visitante com o professor (para conteúdo só-alunos).
  const { data: myLinks = [] } = useStudentCoaches(lessonsOn && !isOwn ? user?.uid : null);
  const isStudent = myLinks.some((l) => l.coach_id === coachId && l.status === STUDENT_STATUS.ACTIVE);
  const { data: contentRaw = [] } = useCoachContent(lessonsOn ? coachId : null, { full: isOwn || isStudent });
  const libraryItems = sortContent(visibleContent(contentRaw, { isOwner: isOwn, isStudent }));
  // Loja pública: sempre só os produtos marcados como públicos (preview fiel).
  const { data: storeProducts = [] } = useCoachProducts(lessonsOn ? coachId : null, { full: false });

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading) return <div className="p-4"><V2Skeleton lines={6} /></div>;
  if (!coach) return (
    <div className="p-4">
      <V2EmptyState icon={GraduationCap} title="Professor não encontrado" />
      <Link to="/coaches" className="mt-3 inline-block text-sm font-bold text-ink">← Voltar ao diretório</Link>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <Link to="/coaches" className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Professores
      </Link>

      {/* Header */}
      <V2Surface>
        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-acid">
            {coach.display_name?.[0] || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink">{coach.display_name}</h1>
              {coach.accepting_students && <V2Badge tone="green">Aceitando alunos</V2Badge>}
              {!coach.active && <V2Badge tone="red">Inativo</V2Badge>}
            </div>
            {coach.bio && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{coach.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(coach.modalities || []).map((m) => (
                <V2Badge key={m} tone="blue">{m}</V2Badge>
              ))}
            </div>
            {coach.regions?.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="h-4 w-4" /> {coach.regions.join(' · ')}
              </div>
            )}
            {coach.hourly_rate != null && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-2xl bg-green-50 px-3 py-1.5 text-sm font-bold text-green-700">
                <Award className="h-4 w-4" /> R$ {Number(coach.hourly_rate).toFixed(2)}/h
              </div>
            )}
            {coach.certifications?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Certificações</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {coach.certifications.map((c) => <V2Badge key={c} tone="neutral">{c}</V2Badge>)}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canRequestLesson && (
                <V2Button size="sm" onClick={() => setRequesting(true)}>
                  <MessageCircle className="h-4 w-4" /> Solicitar aula
                </V2Button>
              )}
              {coach.contact_whatsapp && (
                <a
                  href={`https://wa.me/${String(coach.contact_whatsapp).replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"
                >
                  <Phone className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {coach.contact_email && (
                <a
                  href={`mailto:${coach.contact_email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper"
                >
                  <Mail className="h-3.5 w-3.5" /> E-mail
                </a>
              )}
              {isOwn && lessonsOn && (
                <Link to="/aulas" className="text-xs font-bold text-ink hover:underline">
                  Minha agenda de aulas →
                </Link>
              )}
              {isOwn && (
                <Link to="/coaches" className="text-xs font-bold text-ink hover:underline">
                  Editar meu perfil →
                </Link>
              )}
              <Link to={`/atleta/${coachId}`} className="text-xs font-bold text-ink hover:underline">
                Ver perfil de atleta →
              </Link>
            </div>
          </div>
        </div>
      </V2Surface>

      {/* Fotos */}
      {coach.photos?.length > 0 && (
        <V2Surface>
          <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
            <ImageIcon className="h-4 w-4" /> Fotos
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {coach.photos.map((url, i) => (
              <PhotoLightbox
                key={url || i}
                src={url}
                alt={`Foto ${i + 1} de ${coach.display_name}`}
                trigger={<img src={url} alt="" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />}
              />
            ))}
          </div>
        </V2Surface>
      )}

      {/* Loja pública */}
      {lessonsOn && storeProducts.length > 0 && (
        <V2Surface>
          <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
            <Store className="h-4 w-4" /> Loja
          </h3>
          <p className="mt-1 text-sm text-gray-500">Produtos à venda com este professor. Combine o pagamento diretamente.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {storeProducts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink line-clamp-1">{p.name}</p>
                    {p.description && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                  </div>
                  <V2Badge tone="neutral">{coachProductCategoryLabel(p.category)}</V2Badge>
                </div>
                <p className="mt-2 font-display text-lg font-bold text-ink">{formatCoachProductPrice(p.price)}</p>
              </div>
            ))}
          </div>
        </V2Surface>
      )}

      {/* Residências */}
      <V2Surface>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Arenas parceiras</h3>
          {(isOwn || isPlatformAdmin) && !adding && (
            <V2Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Adicionar</V2Button>
          )}
        </div>
        {adding && <div className="mt-3"><AddResidencyForm coachId={coachId} onClose={() => setAdding(false)} /></div>}
        <div className="mt-3 space-y-2">
          {residencies.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma arena vinculada ainda.</p>
          ) : (
            residencies.map((r) => (
              <ResidencyCard
                key={r.id}
                residency={r}
                canRemove={isOwn || isPlatformAdmin}
                onRemove={() => remove.mutate({ coachId, arenaId: r.arena_id })}
              />
            ))
          )}
        </div>
      </V2Surface>

      {/* Biblioteca de conteúdo (PRO-18) */}
      {lessonsOn && (libraryItems.length > 0 || isOwn) && (
        <V2Surface>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Biblioteca de conteúdo</h3>
            {isOwn && (
              <Link to="/aulas" className="text-xs font-bold text-ink hover:underline">Gerenciar →</Link>
            )}
          </div>
          {libraryItems.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {isOwn ? 'Publique drills e dicas na sua agenda para aparecerem aqui.' : 'Nenhum conteúdo publicado ainda.'}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {libraryItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{item.title}</p>
                    <V2Badge tone="blue">{contentCategoryLabel(item.category)}</V2Badge>
                    {item.visibility === CONTENT_VISIBILITY.STUDENTS && <V2Badge tone="amber">Só alunos</V2Badge>}
                  </div>
                  {item.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{item.body}</p>}
                  {item.video_url && (
                    <a href={item.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                      <Video className="h-3 w-3" /> Ver vídeo
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}

      {canRequestLesson && (
        <RequestLessonDialog coach={coach} open={requesting} onOpenChange={setRequesting} />
      )}
    </div>
  );
}
