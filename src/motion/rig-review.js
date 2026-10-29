// No DOM, dialogs or simulation state. Any view can subscribe to these states.
export function createRigReview({ fit, onChange = () => {} }) {
  let revision = 0;
  let state = { status: 'empty', candidate: null, reason: '', approved: false };
  const publish = next => { state = Object.freeze(next); onChange(state); return state; };
  return {
    getState: () => state,
    reset() {
      revision++;
      return publish({ status: 'empty', candidate: null, reason: '', approved: false });
    },
    async prepare(input) {
      const current = ++revision;
      publish({ status: 'preparing', candidate: null, reason: '', approved: false });
      // Current fitter supports reviewed dog/cat quadrupeds only.
      if (!['dog', 'cat'].includes(input.profile)) {
        return publish({ status: 'fallback', candidate: null, reason: 'This profile uses whole-image movement until its own rig is supported.', approved: false });
      }
      try {
        const candidate = await fit(input, () => current === revision);
        if (current !== revision) return state;
        if (!candidate?.valid) return publish({ status: 'fallback', candidate: null, reason: candidate?.warnings?.join(' ') || 'The pose could not be fitted.', approved: false });
        return publish({ status: 'review', candidate, reason: 'Inspect the moving preview before accepting.', approved: false });
      } catch (error) {
        if (current !== revision) return state;
        return publish({ status: 'fallback', candidate: null, reason: error.message || 'Rig fitting failed.', approved: false });
      }
    },
    accept() {
      if (state.status !== 'review' || !state.candidate) throw new Error('A valid moving preview must be reviewed first.');
      return publish({ ...state, status: 'accepted', reason: 'Rig accepted after visual review.', approved: true });
    },
    requestReview() {
      if (!state.candidate) return state;
      return publish({ ...state, status: 'review', reason: 'Motion changed; inspect the preview again.', approved: false });
    },
    useFallback() {
      if (state.status === 'empty') throw new Error('Choose a creature first.');
      revision++;
      return publish({ status: 'fallback', candidate: null, reason: 'Whole-image movement selected.', approved: true });
    },
  };
}
