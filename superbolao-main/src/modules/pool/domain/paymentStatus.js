export function normalizePaymentStatus(status) {
  if (status === 'confirmed' || status === 'reported') return status;
  return 'unpaid';
}

export function paymentStatusLabel(status) {
  const normalizedStatus = normalizePaymentStatus(status);
  if (normalizedStatus === 'confirmed') return 'Confirmado';
  if (normalizedStatus === 'reported') return 'Informado';
  return 'Pendente';
}

export function participationPaymentStatusLabel(status) {
  const normalizedStatus = normalizePaymentStatus(status);
  if (normalizedStatus === 'confirmed') return 'Pagamento confirmado';
  if (normalizedStatus === 'reported') return 'Pagamento informado';
  return 'Pagamento pendente';
}

export function isConfirmedForRanking(membership) {
  return membership.role === 'owner' || membership.role === 'admin' || normalizePaymentStatus(membership.payment_status) === 'confirmed';
}
