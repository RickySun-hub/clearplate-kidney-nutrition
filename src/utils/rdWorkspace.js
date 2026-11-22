// Presentation state only. All data access remains subject to careCloud and server RLS.
export function patientDirectory(patients, invitations, accountId) {
  const connected = invitations.filter(i => i.reader_id === accountId && i.status === 'accepted' && i.active && i.owner_id);
  const result = new Map(patients.map(p => [p.owner_id, { ...p, email: connected.find(i => i.owner_id === p.owner_id)?.recipient_email || '', noRecord: false }]));
  for (const i of connected) if (!result.has(i.owner_id)) result.set(i.owner_id, {
    owner_id: i.owner_id, profile: { name: i.patient_name || '' }, email: i.recipient_email || '', updated_at: null, noRecord: true,
  });
  return [...result.values()];
}
export function filterPatients(patients, search, status = 'all') {
  const query = search.trim().toLowerCase();
  return patients.filter(p => {
    // Email lookup is limited to complete normalized equality in this consented directory.
    const matches = !query || (query.includes('@')
      ? String(p.email || '').trim().toLowerCase() === query
      : [p.profile?.name, p.owner_id].some(value => String(value || '').toLowerCase().includes(query)));
    return matches && (status === 'all' || (status === 'waiting' ? p.noRecord : !p.noRecord));
  });
}
export function pendingInvitations(invitations, accountId, now = Date.now()) {
  return invitations.filter(i => i.reader_id === accountId && i.status === 'pending'
    && Number.isFinite(Date.parse(i.expires_at)) && Date.parse(i.expires_at) > now);
}

export function createPatientReview(client, onState) {
  let disposed = false, selection = 0, refreshVersion = 0;
  let state = { patients: [], invitations: [], selectedId: null, record: null, updatedAt: null, loading: true, opening: false, error: '' };
  const emit = patch => { if (!disposed) { state = { ...state, ...patch }; onState(state); } };
  const close = () => { selection++; emit({ selectedId: null, record: null, updatedAt: null, opening: false }); };
  async function read(id, version) {
    try {
      const row = await client.read(id);
      if (disposed || version !== selection || state.selectedId !== id) return;
      if (row.owner_id !== id) throw new Error('Patient response did not match the selected file.');
      emit({ record: row.record, updatedAt: row.updated_at, opening: false, error: '' });
    } catch (error) {
      if (disposed || version !== selection) return;
      close(); emit({ error: error.message || 'Patient file could not be opened. Refresh the directory to try again.' });
    }
  }
  return {
    close,
    async open(id) {
      if (disposed || !state.patients.some(p => p.owner_id === id) || state.selectedId === id && state.opening) return;
      const version = ++selection;
      emit({ selectedId: id, record: null, updatedAt: null, opening: true, error: '' });
      await read(id, version);
    },
    async refresh() {
      const version = ++refreshVersion;
      try {
        const [patients, invitations] = await Promise.all([client.shared(), client.invitations()]);
        if (disposed || version !== refreshVersion) return;
        emit({ patients, invitations, loading: false, error: '' });
        const id = state.selectedId;
        if (id && !patients.some(p => p.owner_id === id)) { close(); emit({ error: 'This patient file is no longer available to your account.' }); }
        else if (id && !state.opening) await read(id, ++selection);
      } catch (error) {
        if (disposed || version !== refreshVersion) return;
        close(); emit({ patients: [], invitations: [], loading: false, error: error.message || 'Could not refresh patient access.' });
      }
    },
    dispose() { disposed = true; selection++; refreshVersion++; state = { ...state, patients: [], invitations: [], record: null }; },
  };
}
