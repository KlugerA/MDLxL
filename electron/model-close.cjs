function normalizeModelCloseState(value, previous = { dirty: false, saved: false }) {
  if (value && typeof value === 'object') {
    const state = { dirty: value.dirty === true, saved: value.saved === true }, name = typeof value.name === 'string' && value.name ? value.name : previous.name;
    return name ? { ...state, name } : state;
  }
  return { ...previous, dirty: value === true };
}

function needsModelClosePrompt(state) {
  return state.dirty || !state.saved;
}

function modelClosePrompt(state) {
  const name = state.name || 'the current model';
  return {
    type: 'question',
    buttons: ['Save', 'Cancel', 'Close'],
    defaultId: 0,
    cancelId: 1,
    title: 'Save model?',
    message: state.dirty ? `Save changes to ${name} before closing?` : state.name ? `${name} has not been saved.` : 'The current model has not been saved.',
    detail: 'Save the model, cancel closing, or close without saving.',
  };
}

function modelCloseAction(response) {
  return ['save', 'cancel', 'close'][response] || 'cancel';
}

module.exports = { normalizeModelCloseState, needsModelClosePrompt, modelClosePrompt, modelCloseAction };
