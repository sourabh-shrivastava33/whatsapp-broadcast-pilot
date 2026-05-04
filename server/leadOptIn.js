export const WHATSAPP_INBOUND_OPT_IN_METHOD = 'whatsapp_inbound';

export function shouldApplyInboundOptIn(contact) {
  if (!contact) return true;
  if (contact.isBlocklisted) return false;
  if (contact.optInStatus === 'opted_out') return false;
  if (contact.optInStatus === 'opted_in') return false;
  return true;
}

export function getInboundOptInData(contact, now = new Date()) {
  if (!shouldApplyInboundOptIn(contact)) return {};

  return {
    optInStatus: 'opted_in',
    optInMethod: WHATSAPP_INBOUND_OPT_IN_METHOD,
    optInTimestamp: contact?.optInTimestamp || now,
  };
}
